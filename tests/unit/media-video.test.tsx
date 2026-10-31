// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MediaFigure } from "@/components/media/MediaFigure";
import { checkUpload, MediaMetadata, NonFigurativeConfirmation, NON_FIGURATIVE_ITEMS, videoMetadataProblem, VIDEO_CONFIRMATION } from "@/lib/media/validate";
import { inspectVideo, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, sniffVideoType } from "@/lib/media/video";
import { isVideoRow, videoSource, type PublicMediaRow } from "@/lib/media/render";
import { buildCsp } from "@/lib/security/csp";
import { directive } from "@/lib/security/csp";

vi.mock("server-only", () => ({}));

// ---------- tiny container builders (no ffmpeg): just the header elements the parser reads ----------
const bytes = (...xs: Array<number[] | Uint8Array>) => Uint8Array.from(xs.flatMap((x) => Array.from(x)));
const text = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const be = (n: number, len: number) => Array.from({ length: len }, (_, i) => Math.floor(n / 2 ** (8 * (len - 1 - i))) & 255);

const vsize = (n: number) => [0x10 | ((n >>> 24) & 0x0f), (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const el = (id: number[], ...kids: Array<number[] | Uint8Array>) => {
  const body = bytes(...kids);
  return bytes(id, vsize(body.length), body);
};
const uintEl = (id: number[], n: number) => el(id, n > 255 ? be(n, 4) : [n]);
const f32 = (v: number) => Array.from(new Uint8Array(new Float32Array([v]).buffer).reverse());

interface WebmOpts {
  doc?: string;
  codec?: string;
  w?: number;
  h?: number;
  durationMs?: number | null;
  noTracks?: boolean;
}
function webm(o: WebmOpts = {}): Uint8Array {
  const { doc = "webm", codec = "V_VP9", w = 640, h = 360, durationMs = 5000, noTracks = false } = o;
  const info = el([0x15, 0x49, 0xa9, 0x66], uintEl([0x2a, 0xd7, 0xb1], 1_000_000), ...(durationMs === null ? [] : [el([0x44, 0x89], f32(durationMs))]));
  const tracks = el(
    [0x16, 0x54, 0xae, 0x6b],
    el([0xae], uintEl([0x83], 1), el([0x86], text(codec)), el([0xe0], uintEl([0xb0], w), uintEl([0xba], h))),
    el([0xae], uintEl([0x83], 2), el([0x86], text("A_OPUS"))),
  );
  return bytes(el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x82], text(doc))), el([0x18, 0x53, 0x80, 0x67], info, ...(noTracks ? [] : [tracks]), el([0x1f, 0x43, 0xb6, 0x75], [0xe7, 0x81, 0x00])));
}

const box = (type: string, ...kids: Array<number[] | Uint8Array>) => {
  const body = bytes(...kids);
  return bytes(be(8 + body.length, 4), text(type), body);
};
interface Mp4Opts {
  brand?: string;
  entry?: string;
  w?: number;
  h?: number;
  seconds?: number;
  handler?: string;
  moov?: boolean;
}
function mp4(o: Mp4Opts = {}): Uint8Array {
  const { brand = "isom", entry = "avc1", w = 640, h = 360, seconds = 5, handler = "vide", moov = true } = o;
  const mvhd = box("mvhd", [0, 0, 0, 0], be(0, 4), be(0, 4), be(1000, 4), be(seconds * 1000, 4), new Array(80).fill(0));
  const tkhd = box("tkhd", [0, 0, 0, 3], be(0, 4), be(0, 4), be(1, 4), be(0, 4), be(seconds * 1000, 4), new Array(8).fill(0), new Array(4).fill(0), new Array(4).fill(0), new Array(36).fill(0), be(w * 65536, 4), be(h * 65536, 4));
  const stsd = box("stsd", [0, 0, 0, 0], be(1, 4), box(entry, new Array(78).fill(0)));
  const trak = box("trak", tkhd, box("mdia", box("hdlr", [0, 0, 0, 0], be(0, 4), text(handler), new Array(12).fill(0), [0]), box("minf", box("stbl", stsd))));
  return bytes(box("ftyp", text(brand), be(0, 4), text("isom")), box("free", [0, 0]), ...(moov ? [box("moov", mvhd, trak)] : []), box("mdat", [1, 2, 3]));
}

describe("video sniffing (by bytes, never by name)", () => {
  test("EBML header means WebM, an ftyp box at offset 4 means MP4", () => {
    expect(sniffVideoType(webm())).toBe("webm");
    expect(sniffVideoType(mp4())).toBe("mp4");
    expect(sniffVideoType(Uint8Array.from(text("RIFF....WEBP")))).toBeNull();
    expect(sniffVideoType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(sniffVideoType(new Uint8Array())).toBeNull();
  });

  test("a valid clip passes with its codec, size and duration", () => {
    expect(inspectVideo(webm())).toMatchObject({ ok: true, info: { type: "webm", codec: "VP9", width: 640, height: 360, durationSeconds: 5 } });
    expect(inspectVideo(webm({ codec: "V_VP8" }))).toMatchObject({ ok: true, info: { codec: "VP8" } });
    expect(inspectVideo(webm({ codec: "V_AV1" }))).toMatchObject({ ok: true, info: { codec: "AV1" } });
    expect(inspectVideo(mp4())).toMatchObject({ ok: true, info: { type: "mp4", codec: "H.264", width: 640, height: 360, durationSeconds: 5 } });
    expect(inspectVideo(mp4({ entry: "avc3", brand: "mp42" }))).toMatchObject({ ok: true });
  });

  test("other codecs and containers are refused", () => {
    expect(inspectVideo(webm({ doc: "matroska" }))).toMatchObject({ ok: false, code: "unsupported_video" });
    expect(inspectVideo(webm({ codec: "V_MPEG4/ISO/AVC" }))).toMatchObject({ ok: false, code: "unsupported_codec" });
    expect(inspectVideo(mp4({ entry: "hvc1" }))).toMatchObject({ ok: false, code: "unsupported_codec" });
    expect(inspectVideo(mp4({ entry: "av01" }))).toMatchObject({ ok: false, code: "unsupported_codec" });
    expect(inspectVideo(mp4({ brand: "qt  " }))).toMatchObject({ ok: false, code: "unsupported_video" });
    expect(inspectVideo(mp4({ brand: "heic" }))).toMatchObject({ ok: false, code: "unsupported_video" });
    expect(inspectVideo(mp4({ handler: "soun" }))).toMatchObject({ ok: false, code: "unreadable_video" });
  });

  test("truncated or headerless files are refused, not guessed at", () => {
    expect(inspectVideo(mp4({ moov: false }))).toMatchObject({ ok: false, code: "unreadable_video" });
    expect(inspectVideo(webm({ noTracks: true }))).toMatchObject({ ok: false, code: "unreadable_video" });
    expect(inspectVideo(webm().subarray(0, 12))).toMatchObject({ ok: false });
    expect(inspectVideo(mp4().subarray(0, 14))).toMatchObject({ ok: false });
    expect(inspectVideo(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]))).toMatchObject({ ok: false });
  });

  test("size limits: 16 to 4096 px a side", () => {
    expect(inspectVideo(webm({ w: 8, h: 8 }))).toMatchObject({ ok: false, code: "video_dimensions" });
    expect(inspectVideo(mp4({ w: 5000, h: 100 }))).toMatchObject({ ok: false, code: "video_dimensions" });
    expect(inspectVideo(webm({ w: 0, h: 0 }))).toMatchObject({ ok: false, code: "unreadable_video" });
  });

  test("duration: 20 seconds when readable, bytes-only when the container does not say", () => {
    expect(inspectVideo(webm({ durationMs: MAX_VIDEO_SECONDS * 1000 }))).toMatchObject({ ok: true });
    expect(inspectVideo(webm({ durationMs: MAX_VIDEO_SECONDS * 1000 + 500 }))).toMatchObject({ ok: false, code: "video_too_long" });
    expect(inspectVideo(mp4({ seconds: 21 }))).toMatchObject({ ok: false, code: "video_too_long" });
    expect(inspectVideo(mp4({ seconds: 20 }))).toMatchObject({ ok: true });
    expect(inspectVideo(webm({ durationMs: null }))).toMatchObject({ ok: true, info: { durationSeconds: null } });
  });
});

describe("checkUpload with video", () => {
  test("accepts WebM and MP4 by content and returns their type", () => {
    expect(checkUpload(webm(), "video/webm")).toMatchObject({ ok: true, type: "webm", mime: "video/webm", ext: "webm" });
    expect(checkUpload(mp4(), "video/mp4")).toMatchObject({ ok: true, type: "mp4", mime: "video/mp4", ext: "mp4" });
    expect(checkUpload(mp4(), "application/octet-stream")).toMatchObject({ ok: true });
    expect(checkUpload(mp4(), "")).toMatchObject({ ok: true });
  });

  test("a declared type that disagrees with the content is refused, both ways", () => {
    expect(checkUpload(webm(), "video/mp4")).toMatchObject({ ok: false, code: "type_mismatch" });
    expect(checkUpload(mp4(), "video/webm")).toMatchObject({ ok: false, code: "type_mismatch" });
    expect(checkUpload(webm(), "image/png")).toMatchObject({ ok: false, code: "type_mismatch" });
    expect(checkUpload(mp4(), "application/pdf")).toMatchObject({ ok: false, code: "type_mismatch" });
  });

  test("a file named .mp4 or declared video/mp4 that is not a video is refused", () => {
    expect(checkUpload(Uint8Array.from(text("<html><script>alert(1)</script></html>")), "video/mp4")).toMatchObject({ ok: false, code: "unsupported_type" });
    expect(checkUpload(Uint8Array.from([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "video/mp4")).toMatchObject({ ok: false, code: "executable" });
    expect(checkUpload(Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0, 0, 0, 0]), "video/webm")).toMatchObject({ ok: false, code: "executable" });
    expect(checkUpload(Uint8Array.from(text("#!/bin/sh\nrm -rf /")), "video/mp4")).toMatchObject({ ok: false, code: "executable" });
    expect(checkUpload(Uint8Array.from([0x50, 0x4b, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0]), "video/mp4")).toMatchObject({ ok: false, code: "executable" });
  });

  test("8 MB maximum for a clip (images keep their own limits)", () => {
    const big = new Uint8Array(MAX_VIDEO_BYTES + 1);
    big.set(webm());
    expect(checkUpload(big, "video/webm")).toMatchObject({ ok: false, code: "too_large" });
    const ok = new Uint8Array(MAX_VIDEO_BYTES);
    ok.set(webm());
    // Trailing zero padding after the clusters is harmless to the header parse.
    expect(checkUpload(ok, "video/webm")).toMatchObject({ ok: true });
  });
});

describe("video metadata and confirmation", () => {
  const base = { altText: "A slow pan across a desert horizon at dusk", captionEn: "A desert horizon", category: "landscape", kind: "video", credit: "Fixture", sourceId: "00000000-0000-4000-8000-000000000001" };
  test("a clip needs a description of 20 characters and an English caption", () => {
    expect(videoMetadataProblem(MediaMetadata.parse(base))).toBeNull();
    expect(videoMetadataProblem(MediaMetadata.parse({ ...base, altText: "Desert horizon" }))).toMatch(/at least 20/);
    expect(videoMetadataProblem(MediaMetadata.parse({ ...base, captionEn: "" }))).toMatch(/caption/);
    expect(MediaMetadata.safeParse({ ...base, kind: "audio" }).success).toBe(false);
  });

  test("the clip tick is carried with the non-figurative confirmation and is optional for images", () => {
    const all = Object.fromEntries(NON_FIGURATIVE_ITEMS.map(([k]) => [k, true]));
    expect(NonFigurativeConfirmation.parse(all).noVideoDepiction).toBeUndefined();
    expect(NonFigurativeConfirmation.parse({ ...all, [VIDEO_CONFIRMATION[0]]: true }).noVideoDepiction).toBe(true);
    expect(NonFigurativeConfirmation.safeParse({ ...all, [VIDEO_CONFIRMATION[0]]: false }).success).toBe(false);
    expect(VIDEO_CONFIRMATION[1]).toBe("This clip depicts no prophet, angel, jinn or unseen being.");
  });
});

describe("<MediaFigure> with a clip", () => {
  const clip: PublicMediaRow = {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "video",
    category: "landscape",
    alt_text: "A slow pan across a desert horizon at dusk",
    alt_text_ar: "لقطة بطيئة لأفق الصحراء عند الغروب",
    alt_text_ur: null,
    caption_en: "A desert horizon",
    caption_ar: "أفق الصحراء",
    caption_ur: null,
    credit: "Fixture credit",
    file_id: "22222222-2222-4222-8222-222222222222",
    version: 1,
    storage_path: "assets/22222222-2222-4222-8222-222222222222/original.webm",
    mime_type: "video/webm",
    width: 640,
    height: 360,
    variants: [],
    attribution: "Fixture licence attribution",
    licence: null,
    license_url: null,
  };

  test("renders a player with controls, no autoplay, no loop, metadata preload and a linked text description", () => {
    const { container } = render(<MediaFigure row={clip} locale="en" supabaseUrl="https://x.supabase.co" />);
    const video = container.querySelector("video")!;
    expect(video).toBeTruthy();
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.hasAttribute("loop")).toBe(false);
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.hasAttribute("poster")).toBe(false);
    expect(video.hasAttribute("tabindex") ? video.getAttribute("tabindex") : "0").not.toBe("-1");
    const source = video.querySelector("source")!;
    expect(source.getAttribute("src")).toBe("https://x.supabase.co/storage/v1/object/public/media/assets/22222222-2222-4222-8222-222222222222/original.webm");
    expect(source.getAttribute("type")).toBe("video/webm");
    const desc = screen.getByTestId("media-description");
    expect(desc).toHaveTextContent("A slow pan across a desert horizon at dusk");
    expect(video.getAttribute("aria-describedby")).toBe(desc.id);
    expect(screen.getByText("A desert horizon")).toBeInTheDocument();
    expect(screen.getByTestId("media-credit")).toHaveTextContent("Fixture credit · Fixture licence attribution");
  });

  test("Arabic: description and caption are in Arabic and right-to-left; Urdu falls back to English", () => {
    const ar = render(<MediaFigure row={clip} locale="ar" supabaseUrl="https://x.supabase.co" />);
    const desc = ar.getByTestId("media-description");
    expect(desc).toHaveAttribute("lang", "ar");
    expect(desc).toHaveAttribute("dir", "rtl");
    expect(desc).toHaveTextContent("لقطة بطيئة");
    expect(ar.getByText("أفق الصحراء")).toHaveAttribute("dir", "rtl");
    ar.unmount();
    const ur = render(<MediaFigure row={clip} locale="ur" supabaseUrl="https://x.supabase.co" />);
    expect(ur.getByTestId("media-description")).toHaveAttribute("lang", "en");
  });

  test("hideCaption hides the caption but never the description or the credit", () => {
    render(<MediaFigure row={clip} locale="en" supabaseUrl="https://x.supabase.co" hideCaption />);
    expect(screen.queryByText("A desert horizon")).toBeNull();
    expect(screen.getByTestId("media-description")).toBeInTheDocument();
    expect(screen.getByTestId("media-credit")).toBeInTheDocument();
  });

  test("never renders a clip still in pending/, or an unsupported video type", () => {
    const pending = render(<MediaFigure row={{ ...clip, storage_path: clip.storage_path.replace("assets/", "pending/") }} locale="en" supabaseUrl="https://x.supabase.co" fallback={<p>fallback</p>} />);
    expect(pending.container.querySelector("video")).toBeNull();
    expect(screen.getByText("fallback")).toBeInTheDocument();
    pending.unmount();
    expect(videoSource("https://x.supabase.co", { ...clip, mime_type: "video/ogg" })).toBeNull();
    expect(isVideoRow({ mime_type: "video/ogg" })).toBe(false);
    expect(isVideoRow(clip)).toBe(true);
  });

  test("an image row still renders as an image", () => {
    const { container } = render(<MediaFigure row={{ ...clip, kind: "image", mime_type: "image/png", storage_path: "assets/22222222-2222-4222-8222-222222222222/original.png", variants: [{ w: 320, h: 180, name: "w320.webp" }] }} locale="en" supabaseUrl="https://x.supabase.co" />);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});

describe("CSP for clips", () => {
  test("media-src allows only this site, blob: and the storage origin (no wildcard, no third party)", () => {
    const p = buildCsp({ nonce: "AAAAAAAAAAAAAAAAAAAAAA==", supabaseUrl: "https://abcd.supabase.co", siteUrl: "https://qitl.example" });
    expect(directive(p, "media-src")).toBe("media-src 'self' blob: https://abcd.supabase.co");
    expect(p).not.toMatch(/media-src[^;]*\*/);
  });
});
