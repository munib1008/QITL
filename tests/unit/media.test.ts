// @vitest-environment node
import sharp from "sharp";
import { describe, expect, test, vi } from "vitest";
import { checkDimensions, checkUpload, executableKind, MediaMetadata, NonFigurativeConfirmation, NON_FIGURATIVE_ITEMS, sniffImageType, variantWidths } from "@/lib/media/validate";
import { sanitizeSvg, SvgRejected } from "@/lib/media/svg";
import { altFor, captionFor, creditLine, pickVariant, variantUrls } from "@/lib/media/render";
import { getScanner, HttpScanner, noScanner } from "@/lib/media/scanner";

vi.mock("server-only", () => ({}));

const enc = (s: string) => new TextEncoder().encode(s);
const png = () => sharp({ create: { width: 800, height: 600, channels: 3, background: "#2a6f5b" } }).png().toBuffer();

describe("magic-byte sniffing", () => {
  test("recognises the five image types by content", async () => {
    expect(sniffImageType(await png())).toBe("png");
    expect(sniffImageType(await sharp({ create: { width: 20, height: 20, channels: 3, background: "#000" } }).jpeg().toBuffer())).toBe("jpeg");
    expect(sniffImageType(await sharp({ create: { width: 20, height: 20, channels: 3, background: "#000" } }).webp().toBuffer())).toBe("webp");
    expect(sniffImageType(await sharp({ create: { width: 20, height: 20, channels: 3, background: "#000" } }).gif().toBuffer())).toBe("gif");
    expect(sniffImageType(enc('<?xml version="1.0"?>\n<!-- c --><svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("svg");
    expect(sniffImageType(enc("﻿<svg viewBox='0 0 1 1'></svg>"))).toBe("svg");
  });

  test("refuses executables, archives, HTML and unknown content whatever the name", () => {
    expect(executableKind(Uint8Array.from([0x4d, 0x5a, 0x90, 0]))).toMatch(/windows/);
    expect(checkUpload(Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 2, 1]), "image/png")).toMatchObject({ ok: false, code: "executable" });
    expect(checkUpload(enc("#!/bin/sh\necho hi"), "image/png")).toMatchObject({ ok: false, code: "executable" });
    expect(checkUpload(Uint8Array.from([0x50, 0x4b, 3, 4, 0]), "image/jpeg")).toMatchObject({ ok: false, code: "executable" });
    expect(checkUpload(enc("%PDF-1.7"), "image/png")).toMatchObject({ ok: false, code: "executable" });
    expect(checkUpload(enc("<html><script>alert(1)</script></html>"), "image/svg+xml")).toMatchObject({ ok: false, code: "unsupported_type" });
    expect(checkUpload(enc("BM....bitmap"), "image/bmp")).toMatchObject({ ok: false, code: "unsupported_type" });
    expect(checkUpload(new Uint8Array(), null)).toMatchObject({ ok: false, code: "empty" });
  });

  test("a declared type that disagrees with the content is refused", async () => {
    expect(checkUpload(await png(), "image/jpeg")).toMatchObject({ ok: false, code: "type_mismatch" });
    expect(checkUpload(await png(), "image/png")).toMatchObject({ ok: true, type: "png", mime: "image/png", ext: "png" });
    expect(checkUpload(await png(), "application/octet-stream")).toMatchObject({ ok: true });
  });

  test("size limits per type", () => {
    const bigSvg = enc(`<svg xmlns="http://www.w3.org/2000/svg">${" ".repeat(1024 * 1024)}</svg>`);
    expect(checkUpload(bigSvg, "image/svg+xml")).toMatchObject({ ok: false, code: "too_large" });
    const bigGif = new Uint8Array(5 * 1024 * 1024 + 1);
    bigGif.set(enc("GIF89a"));
    expect(checkUpload(bigGif, "image/gif")).toMatchObject({ ok: false, code: "too_large" });
  });

  test("dimensions and renditions", () => {
    expect(checkDimensions(13000, 100)).toMatch(/12000/);
    expect(checkDimensions(8000, 8000)).toMatch(/megapixels/);
    expect(checkDimensions(8, 8)).toMatch(/16 px/);
    expect(checkDimensions(800, 600)).toBeNull();
    expect(variantWidths(800)).toEqual([320, 640]);
    expect(variantWidths(3000)).toEqual([320, 640, 960, 1280, 1920, 2560]);
    expect(variantWidths(200)).toEqual([200]);
  });
});

describe("metadata", () => {
  const base = { altText: "A geometric rosette", category: "pattern", credit: "Fixture", sourceId: "00000000-0000-4000-8000-000000000001" };
  test("alt text is required, other languages optional, blanks become null", () => {
    expect(MediaMetadata.safeParse({ ...base, altText: " " }).success).toBe(false);
    const r = MediaMetadata.parse({ ...base, altTextAr: "", captionUr: "  " });
    expect(r.altTextAr).toBeNull();
    expect(r.captionUr).toBeNull();
    expect(MediaMetadata.safeParse({ ...base, altTextUr: "ab" }).success).toBe(false);
    expect(MediaMetadata.safeParse({ ...base, category: "portrait" }).success).toBe(false);
    expect(MediaMetadata.safeParse({ ...base, sourceId: "x" }).success).toBe(false);
  });
  test("the non-figurative confirmation needs every item", () => {
    const all = Object.fromEntries(NON_FIGURATIVE_ITEMS.map(([k]) => [k, true]));
    expect(NonFigurativeConfirmation.safeParse(all).success).toBe(true);
    expect(NonFigurativeConfirmation.safeParse({ ...all, noUnseen: false }).success).toBe(false);
    expect(NonFigurativeConfirmation.safeParse({}).success).toBe(false);
  });
});

describe("SVG sanitiser", () => {
  const svg = (inner: string, attrs = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"${attrs}>${inner}</svg>`;

  test("keeps drawing elements and safe attributes", () => {
    const r = sanitizeSvg(svg('<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/><use href="#g"/>'));
    expect(r.svg).toContain('<rect width="10" height="10" fill="url(#g)"/>');
    expect(r.svg).toContain('<use href="#g"/>');
    expect(r.removed).toEqual([]);
  });

  test("removes scripts, foreign objects, styles, images, animation and handlers", () => {
    const r = sanitizeSvg(
      svg(
        '<script>alert(1)</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><iframe src="https://x"/></div></foreignObject><style>@import url(https://x/a.css)</style><image href="https://x/a.png"/><circle r="1" onload="alert(1)" onclick="x()"/><animate attributeName="href" to="javascript:alert(1)"/><SCRIPT>bad()</SCRIPT>',
        ' onload="alert(1)"',
      ),
    );
    expect(r.svg).not.toMatch(/script|foreignObject|style|image|onload|onclick|animate|iframe|alert/i);
    expect(r.svg).toContain('<circle r="1"/>');
    expect(r.removed.length).toBeGreaterThan(4);
  });

  test("removes external references, including encoded javascript: and url() to other hosts", () => {
    const r = sanitizeSvg(
      svg('<a href="https://evil.example"><path d="M0 0" fill="url(https://evil.example/p.svg#x)" style="fill: url(&#x27;http://x&#x27;)"/></a><use xlink:href="&#106;avascript:alert(1)"/><use href="other.svg#a"/><rect filter="url(data:image/svg+xml;base64,AAA)"/>', ' xmlns:xlink="http://www.w3.org/1999/xlink" xml:base="https://evil.example/"'),
    );
    expect(r.svg).not.toMatch(/evil|javascript|other\.svg|data:|http:\/\/x|xml:base/);
    expect(r.svg).toContain('<path d="M0 0"/>');
    expect(r.svg).not.toContain("<a ");
  });

  test("refuses XXE, unknown entities, malformed or non-svg documents", () => {
    expect(() => sanitizeSvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>')).toThrow(SvgRejected);
    expect(() => sanitizeSvg(svg("<text>&x;</text>"))).toThrow(SvgRejected);
    expect(() => sanitizeSvg("<html><svg></svg></html>")).toThrow(/root element must be <svg>/);
    expect(() => sanitizeSvg(svg("<g><rect></g>"))).toThrow(/mismatched/);
    expect(() => sanitizeSvg(svg("<rect width=10/>"))).toThrow(/malformed/);
    expect(() => sanitizeSvg(svg("") + "<script>x</script>")).toThrow(/after the root/);
  });

  test("escapes text and keeps the namespace", () => {
    const r = sanitizeSvg('<svg viewBox="0 0 1 1"><text>a &lt; b &amp; c</text><title>x</title></svg>');
    expect(r.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(r.svg).toContain("<text>a &lt; b &amp; c</text>");
  });
});

describe("processing (sharp)", () => {
  test("re-encodes rasters, strips metadata, drops appended payloads and makes WebP renditions", async () => {
    const { processUpload } = await import("@/lib/media/process");
    const withExif = await sharp({ create: { width: 1000, height: 500, channels: 3, background: "#123456" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "fixture", ImageDescription: "secret location" } })
      .toBuffer();
    const polyglot = Buffer.concat([withExif, Buffer.from("<script>alert(1)</script>")]);
    const out = await processUpload(polyglot, "image/jpeg");
    expect(out).toMatchObject({ type: "jpeg", mime: "image/jpeg", ext: "jpg", width: 1000, height: 500, sanitised: false });
    expect(out.original.includes(Buffer.from("<script>"))).toBe(false);
    expect((await sharp(out.original).metadata()).exif).toBeUndefined();
    expect(out.variants.map((v) => [v.w, v.name])).toEqual([
      [320, "w320.webp"],
      [640, "w640.webp"],
      [960, "w960.webp"],
    ]);
    for (const v of out.variants) expect(sniffImageType(v.data)).toBe("webp");
    expect(out.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test("sanitises SVG and rasterises its renditions", async () => {
    const { processUpload } = await import("@/lib/media/process");
    const out = await processUpload(enc('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><script>x()</script><rect width="400" height="200" fill="#0a5"/></svg>'), "image/svg+xml");
    expect(out.sanitised).toBe(true);
    expect(out.removed).toContain("<script>");
    expect(out.original.toString()).not.toContain("script");
    expect(out.variants[0]).toMatchObject({ w: 320, name: "w320.webp" });
  });

  test("animated GIFs are accepted; corrupt and oversized images are refused", async () => {
    const { processUpload, UploadRejected } = await import("@/lib/media/process");
    const gif = await sharp({ create: { width: 64, height: 64, channels: 4, background: "#f00" } }).gif().toBuffer();
    expect((await processUpload(gif, "image/gif")).type).toBe("gif");
    const truncated = (await png()).subarray(0, 60);
    await expect(processUpload(truncated, "image/png")).rejects.toBeInstanceOf(UploadRejected);
    await expect(processUpload(Uint8Array.from([0x4d, 0x5a, 1, 2]), "image/png")).rejects.toMatchObject({ code: "executable" });
  });
});

describe("rendering helpers", () => {
  const row = {
    alt_text: "A rosette",
    alt_text_ar: "زخرفة",
    alt_text_ur: null,
    caption_en: "Caption",
    caption_ar: null,
    caption_ur: "اردو",
    credit: "Fixture credit",
    attribution: "Fixture licence",
    storage_path: "assets/11111111-1111-4111-8111-111111111111/original.png",
    variants: [
      { w: 640, h: 480, name: "w640.webp" },
      { w: 320, h: 240, name: "w320.webp" },
      { w: 1, h: 1, name: "../evil.webp" },
    ],
  };
  test("alt text and captions in the reader's language, English fallback", () => {
    expect(altFor(row, "ar")).toEqual({ text: "زخرفة", lang: "ar" });
    expect(altFor(row, "ur")).toEqual({ text: "A rosette", lang: "en" });
    expect(captionFor(row, "ur")).toEqual({ text: "اردو", lang: "ur" });
    expect(captionFor(row, "ar")).toEqual({ text: "Caption", lang: "en" });
    expect(captionFor({ caption_en: null, caption_ar: null, caption_ur: null }, "en")).toBeNull();
  });
  test("credit line and variants", () => {
    expect(creditLine(row)).toBe("Fixture credit · Fixture licence");
    expect(creditLine({ credit: "Fixture licence, 2026", attribution: "Fixture licence" })).toBe("Fixture licence, 2026");
    const urls = variantUrls("https://x.supabase.co/", row);
    expect(urls.map((u) => u.w)).toEqual([320, 640]);
    expect(urls[0]!.url).toBe("https://x.supabase.co/storage/v1/object/public/media/assets/11111111-1111-4111-8111-111111111111/w320.webp");
    expect(pickVariant(urls, 500)!.w).toBe(640);
    expect(pickVariant(urls, 4000)!.w).toBe(640);
    expect(variantUrls("https://x.supabase.co", { ...row, storage_path: "pending/11111111-1111-4111-8111-111111111111/original.png" })).toEqual([]);
  });
});

describe("scanner", () => {
  test("without MALWARE_SCAN_URL nothing is scanned", async () => {
    expect(getScanner({} as NodeJS.ProcessEnv)).toBe(noScanner);
    expect(await noScanner.scan(new Uint8Array([1]), { sha256: "x", mime: "image/png" })).toEqual({ status: "not_scanned", engine: null });
  });
  test("the HTTP scanner maps answers, and anything odd is 'failed', never 'clean'", async () => {
    const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    const meta = { sha256: "a".repeat(64), mime: "image/png" };
    expect(await new HttpScanner("https://scan.example/v1", "t", 1000, answer({ result: "clean", engine: "fixture" })).scan(new Uint8Array([1]), meta)).toEqual({ status: "clean", engine: "fixture" });
    expect((await new HttpScanner("https://scan.example/v1", undefined, 1000, answer({ result: "infected", signature: "EICAR" })).scan(new Uint8Array([1]), meta)).status).toBe("infected");
    expect((await new HttpScanner("https://scan.example/v1", undefined, 1000, answer({ ok: true })).scan(new Uint8Array([1]), meta)).status).toBe("failed");
    expect((await new HttpScanner("https://scan.example/v1", undefined, 1000, answer({}, 500)).scan(new Uint8Array([1]), meta)).status).toBe("failed");
    const boom = vi.fn(async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    expect((await new HttpScanner("https://scan.example/v1", undefined, 1000, boom).scan(new Uint8Array([1]), meta)).status).toBe("failed");
    expect(() => new HttpScanner("http://scan.example/v1")).toThrow(/https/);
    expect(getScanner({ MALWARE_SCAN_URL: "http://localhost:9000/scan" } as unknown as NodeJS.ProcessEnv).configured).toBe(true);
  });
  test("the token is sent as a bearer header", async () => {
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-fixture");
      return new Response(JSON.stringify({ result: "clean" }));
    });
    await new HttpScanner("https://scan.example/v1", "secret-fixture", 1000, f as unknown as typeof fetch).scan(new Uint8Array([1]), { sha256: "x", mime: "image/png" });
    expect(f).toHaveBeenCalledOnce();
  });
});
