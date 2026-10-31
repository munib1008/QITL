/**
 * Video clips for the Media Library. Pure (no Node or DOM APIs), unit-tested directly.
 *
 * Only two containers are accepted, decided by their magic bytes and never by the file name or the browser's declared
 * type: WebM (EBML header 1A45DFA3, DocType "webm", video codec VP8, VP9 or AV1) and MP4 (an 'ftyp' box at offset 4
 * with an MP4 brand, video codec H.264 = avc1/avc3). Nothing is transcoded, re-muxed or stripped (there is no ffmpeg):
 * the bytes the editor uploaded are the bytes that are stored, so the file is reviewed exactly as it will be served.
 *
 * What is read from the container headers (cheap, no decoding): the pixel size and the duration. A clip may be at most
 * 8 MB and, when its duration is readable, at most 20 seconds. A WebM written by a live recorder often carries no
 * Duration element; then the limit is bytes-only (8 MB) and the result says `durationSeconds: null`.
 */

export type VideoType = "webm" | "mp4";

export const VIDEO_MIME: Record<VideoType, string> = { webm: "video/webm", mp4: "video/mp4" };
export const VIDEO_EXT: Record<VideoType, string> = { webm: "webm", mp4: "mp4" };
export const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 20;
export const MIN_VIDEO_SIDE = 16;
export const MAX_VIDEO_SIDE = 4096;
/** A clip's description (its alt text, the transcript-style text shown with it) is never a few words. */
export const MIN_VIDEO_DESCRIPTION = 20;

export interface VideoInfo {
  type: VideoType;
  codec: string;
  width: number;
  height: number;
  /** Seconds, or null when the container does not say (the 8 MB limit still applies). */
  durationSeconds: number | null;
}

export type VideoCheck =
  | { ok: true; info: VideoInfo }
  | { ok: false; code: "unsupported_video" | "unreadable_video" | "unsupported_codec" | "video_dimensions" | "video_too_long"; message: string };

const ascii = (b: Uint8Array, from: number, to: number) => {
  let s = "";
  for (let i = from; i < Math.min(to, b.length); i++) s += String.fromCharCode(b[i]!);
  return s;
};
const u32 = (b: Uint8Array, at: number) => (at + 4 <= b.length ? ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0 : -1);
const u64 = (b: Uint8Array, at: number) => {
  const hi = u32(b, at);
  const lo = u32(b, at + 4);
  return hi < 0 || lo < 0 ? -1 : hi * 2 ** 32 + lo;
};

/** Container sniffing by content only. */
export function sniffVideoType(b: Uint8Array): VideoType | null {
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  if (b.length >= 12 && ascii(b, 4, 8) === "ftyp") return "mp4";
  return null;
}

// ---------- WebM (EBML) ----------
const WEBM_CODECS: Record<string, string> = { V_VP8: "VP8", V_VP9: "VP9", V_AV1: "AV1" };
const ID = {
  EBML: 0x1a45dfa3,
  DocType: 0x4282,
  Segment: 0x18538067,
  Info: 0x1549a966,
  TimecodeScale: 0x2ad7b1,
  Duration: 0x4489,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackType: 0x83,
  CodecID: 0x86,
  Video: 0xe0,
  PixelWidth: 0xb0,
  PixelHeight: 0xba,
  Cluster: 0x1f43b675,
} as const;

interface Elem {
  id: number;
  start: number; // payload start
  end: number; // payload end (clamped to the buffer)
  unknown: boolean;
}

/** Read an EBML element header at `pos`; null when it is truncated or malformed. */
function ebmlHeader(b: Uint8Array, pos: number, limit: number): Elem | null {
  if (pos >= limit) return null;
  const first = b[pos]!;
  let idLen = 1;
  while (idLen <= 4 && !(first & (0x80 >> (idLen - 1)))) idLen++;
  if (idLen > 4 || pos + idLen >= limit) return null;
  let id = 0;
  for (let i = 0; i < idLen; i++) id = id * 256 + b[pos + i]!;
  const sp = pos + idLen;
  const sFirst = b[sp]!;
  let sLen = 1;
  while (sLen <= 8 && !(sFirst & (0x80 >> (sLen - 1)))) sLen++;
  if (sLen > 8 || sp + sLen > limit) return null;
  let size = sFirst & (0xff >> sLen);
  let allOnes = size === 0xff >> sLen;
  for (let i = 1; i < sLen; i++) {
    const v = b[sp + i]!;
    size = size * 256 + v;
    if (v !== 0xff) allOnes = false;
  }
  const start = sp + sLen;
  if (allOnes) return { id, start, end: limit, unknown: true };
  return { id, start, end: Math.min(start + size, limit), unknown: false };
}

const ebmlUint = (b: Uint8Array, e: Elem) => {
  let v = 0;
  for (let i = e.start; i < e.end && i < e.start + 8; i++) v = v * 256 + b[i]!;
  return v;
};
function ebmlFloat(b: Uint8Array, e: Elem): number | null {
  const n = e.end - e.start;
  if (n !== 4 && n !== 8) return null;
  const v = new DataView(b.buffer, b.byteOffset + e.start, n);
  return n === 4 ? v.getFloat32(0) : v.getFloat64(0);
}

function* ebmlChildren(b: Uint8Array, start: number, end: number): Generator<Elem> {
  let pos = start;
  for (let guard = 0; guard < 20_000 && pos < end; guard++) {
    const e = ebmlHeader(b, pos, end);
    if (!e) return;
    yield e;
    if (e.end <= pos) return;
    pos = e.end;
  }
}

function parseWebm(b: Uint8Array): VideoCheck {
  const bad = (message: string, code: "unreadable_video" | "unsupported_codec" | "unsupported_video" = "unreadable_video"): VideoCheck => ({ ok: false, code, message });
  let docType = "";
  let seg: Elem | null = null;
  for (const e of ebmlChildren(b, 0, b.length)) {
    if (e.id === ID.EBML) {
      for (const c of ebmlChildren(b, e.start, e.end)) if (c.id === ID.DocType) docType = ascii(b, c.start, c.end);
    } else if (e.id === ID.Segment) {
      seg = e;
      break;
    }
  }
  if (docType !== "webm") return bad("The file is not a WebM video (its document type is not webm).", "unsupported_video");
  if (!seg) return bad("The WebM file has no segment (truncated or corrupt).");

  let scale = 1_000_000;
  let rawDuration: number | null = null;
  let tracksSeen = false;
  let video: { codec: string; w: number; h: number } | null = null;
  let otherCodec: string | null = null;
  for (const e of ebmlChildren(b, seg.start, seg.end)) {
    if (e.id === ID.Cluster) break; // the headers we need come before the first cluster
    if (e.id === ID.Info) {
      for (const c of ebmlChildren(b, e.start, e.end)) {
        if (c.id === ID.TimecodeScale) scale = ebmlUint(b, c) || scale;
        else if (c.id === ID.Duration) rawDuration = ebmlFloat(b, c);
      }
    } else if (e.id === ID.Tracks) {
      tracksSeen = true;
      for (const t of ebmlChildren(b, e.start, e.end)) {
        if (t.id !== ID.TrackEntry) continue;
        let type = 0;
        let codecId = "";
        let w = 0;
        let h = 0;
        for (const c of ebmlChildren(b, t.start, t.end)) {
          if (c.id === ID.TrackType) type = ebmlUint(b, c);
          else if (c.id === ID.CodecID) codecId = ascii(b, c.start, c.end);
          else if (c.id === ID.Video) {
            for (const v of ebmlChildren(b, c.start, c.end)) {
              if (v.id === ID.PixelWidth) w = ebmlUint(b, v);
              else if (v.id === ID.PixelHeight) h = ebmlUint(b, v);
            }
          }
        }
        if (type === 1 && !video) {
          if (!WEBM_CODECS[codecId]) otherCodec = codecId || "unknown";
          else video = { codec: WEBM_CODECS[codecId]!, w, h };
        }
      }
    }
  }
  if (!tracksSeen) return bad("The WebM headers are unreadable (no track list before the first cluster).");
  if (!video) return bad(otherCodec ? `The WebM video codec ${otherCodec} is not accepted; use VP8, VP9 or AV1.` : "The WebM file has no video track.", otherCodec ? "unsupported_codec" : "unreadable_video");
  const seconds = rawDuration !== null && Number.isFinite(rawDuration) && rawDuration > 0 ? (rawDuration * scale) / 1e9 : null;
  return { ok: true, info: { type: "webm", codec: video.codec, width: video.w, height: video.h, durationSeconds: seconds } };
}

// ---------- MP4 (ISO base media) ----------
const MP4_BRANDS = new Set(["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash", "msdh", "msix"]);

interface Box {
  type: string;
  start: number; // payload start
  end: number;
}

function* mp4Boxes(b: Uint8Array, start: number, end: number): Generator<Box> {
  let pos = start;
  for (let guard = 0; guard < 20_000 && pos + 8 <= end; guard++) {
    let size = u32(b, pos);
    const type = ascii(b, pos + 4, pos + 8);
    let hdr = 8;
    if (size === 1) {
      size = u64(b, pos + 8);
      hdr = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < hdr || pos + size > end) {
      // A truncated last box: hand back what is there so the caller can decide (moov must be whole).
      if (size >= hdr) yield { type, start: pos + hdr, end: Math.min(end, pos + size) };
      return;
    }
    yield { type, start: pos + hdr, end: pos + size };
    pos += size;
  }
}

function parseMp4(b: Uint8Array): VideoCheck {
  const bad = (message: string, code: "unreadable_video" | "unsupported_codec" | "unsupported_video" = "unreadable_video"): VideoCheck => ({ ok: false, code, message });
  const brand = ascii(b, 8, 12);
  if (!MP4_BRANDS.has(brand)) return bad(`The file is not an MP4 video (brand "${brand.trim()}"); QuickTime, 3GP, HEIC and audio-only files are not accepted.`, "unsupported_video");
  let moov: Box | null = null;
  for (const bx of mp4Boxes(b, 0, b.length)) {
    if (bx.type === "moov") {
      moov = bx;
      break;
    }
  }
  if (!moov) return bad("The MP4 has no movie header (moov); it is truncated or not yet finalised.");

  let timescale = 0;
  let duration = 0;
  let video: { codec: string; w: number; h: number } | null = null;
  let otherCodec: string | null = null;
  for (const bx of mp4Boxes(b, moov.start, moov.end)) {
    if (bx.type === "mvhd") {
      const v = b[bx.start] ?? 0;
      timescale = u32(b, bx.start + (v === 1 ? 20 : 12));
      duration = v === 1 ? u64(b, bx.start + 24) : u32(b, bx.start + 16);
    } else if (bx.type === "trak" && !video) {
      let tw = 0;
      let th = 0;
      let handler = "";
      let entry = "";
      for (const t of mp4Boxes(b, bx.start, bx.end)) {
        if (t.type === "tkhd") {
          const v = b[t.start] ?? 0;
          const at = t.start + (v === 1 ? 88 : 76);
          tw = Math.floor(u32(b, at) / 65536);
          th = Math.floor(u32(b, at + 4) / 65536);
        } else if (t.type === "mdia") {
          for (const m of mp4Boxes(b, t.start, t.end)) {
            if (m.type === "hdlr") handler = ascii(b, m.start + 8, m.start + 12);
            else if (m.type === "minf") {
              for (const n of mp4Boxes(b, m.start, m.end)) {
                if (n.type !== "stbl") continue;
                for (const s of mp4Boxes(b, n.start, n.end)) {
                  if (s.type === "stsd" && u32(b, s.start + 4) >= 1) entry = ascii(b, s.start + 12, s.start + 16);
                }
              }
            }
          }
        }
      }
      if (handler === "vide") {
        if (entry === "avc1" || entry === "avc3") video = { codec: "H.264", w: tw, h: th };
        else otherCodec = entry || "unknown";
      }
    }
  }
  if (!video) return bad(otherCodec ? `The MP4 video codec "${otherCodec}" is not accepted; use H.264 (avc1).` : "The MP4 file has no video track.", otherCodec ? "unsupported_codec" : "unreadable_video");
  const seconds = timescale > 0 && duration > 0 && duration < 2 ** 52 ? duration / timescale : null;
  return { ok: true, info: { type: "mp4", codec: video.codec, width: video.w, height: video.h, durationSeconds: seconds } };
}

/**
 * Read a video's container headers and apply the clip limits (size is checked by the caller with the other uploads):
 * a known container and codec, a readable pixel size within 16-4096 px a side and, when the duration is readable, at
 * most 20 seconds.
 */
export function inspectVideo(b: Uint8Array): VideoCheck {
  const type = sniffVideoType(b);
  if (!type) return { ok: false, code: "unsupported_video", message: "Only WebM (VP8, VP9, AV1) and MP4 (H.264) video is accepted." };
  const r = type === "webm" ? parseWebm(b) : parseMp4(b);
  if (!r.ok) return r;
  const { width, height, durationSeconds } = r.info;
  if (!width || !height) return { ok: false, code: "unreadable_video", message: "The video has no readable size in its headers." };
  if (width < MIN_VIDEO_SIDE || height < MIN_VIDEO_SIDE) return { ok: false, code: "video_dimensions", message: `Videos must be at least ${MIN_VIDEO_SIDE} px on each side.` };
  if (width > MAX_VIDEO_SIDE || height > MAX_VIDEO_SIDE) return { ok: false, code: "video_dimensions", message: `Videos may be at most ${MAX_VIDEO_SIDE} px on a side.` };
  if (durationSeconds !== null && durationSeconds > MAX_VIDEO_SECONDS) {
    return { ok: false, code: "video_too_long", message: `Clips may be at most ${MAX_VIDEO_SECONDS} seconds (this one is ${durationSeconds.toFixed(1)} s).` };
  }
  return r;
}
