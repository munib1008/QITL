import { z } from "zod";
import { inspectVideo, MAX_VIDEO_BYTES, MIN_VIDEO_DESCRIPTION, sniffVideoType, VIDEO_EXT, VIDEO_MIME, type VideoInfo, type VideoType } from "./video";

/**
 * Upload validation for the Media Library. Pure (no Node or DOM APIs) so it is unit-tested directly.
 * The file type is decided by its magic bytes, never by the name or the browser's declared type, and only five
 * image formats and two video containers (WebM, MP4; see ./video.ts) are accepted: anything executable, archived,
 * scripted or unknown is refused.
 */

export type ImageType = "png" | "jpeg" | "webp" | "gif" | "svg";
export type MediaType = ImageType | VideoType;

export const MIME: Record<ImageType, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};
export const EXT: Record<ImageType, string> = { png: "png", jpeg: "jpg", webp: "webp", gif: "gif", svg: "svg" };

/** Size limits per type (bytes). The storage bucket refuses anything over 10 MB as well. */
export const MAX_BYTES: Record<ImageType, number> = {
  png: 10 * 1024 * 1024,
  jpeg: 10 * 1024 * 1024,
  webp: 10 * 1024 * 1024,
  gif: 5 * 1024 * 1024,
  svg: 1024 * 1024,
};
/** Decompression-bomb guard: no image over 40 megapixels or 12,000 px on a side. */
export const MAX_PIXELS = 40_000_000;
export const MAX_SIDE = 12_000;
/** Responsive WebP renditions generated for every upload (never wider than the original). */
export const VARIANT_WIDTHS = [320, 640, 960, 1280, 1920, 2560] as const;

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, Math.min(to, b.length)));

/** Signatures of content that must never be stored, whatever it claims to be. */
const EXECUTABLE_SIGNATURES: Array<[string, number[]]> = [
  ["windows executable", [0x4d, 0x5a]], // MZ
  ["ELF executable", [0x7f, 0x45, 0x4c, 0x46]],
  ["Mach-O executable", [0xcf, 0xfa, 0xed, 0xfe]],
  ["Mach-O executable", [0xfe, 0xed, 0xfa, 0xcf]],
  ["Java class / Mach-O universal", [0xca, 0xfe, 0xba, 0xbe]],
  ["script", [0x23, 0x21]], // #!
  ["zip archive", [0x50, 0x4b, 0x03, 0x04]],
  ["PDF", [0x25, 0x50, 0x44, 0x46]],
  ["WebAssembly", [0x00, 0x61, 0x73, 0x6d]],
];

export function executableKind(b: Uint8Array): string | null {
  for (const [name, sig] of EXECUTABLE_SIGNATURES) if (startsWith(b, sig)) return name;
  return null;
}

/** Decide the image type from the bytes. SVG is recognised as UTF-8 text whose first element is <svg>. */
export function sniffImageType(b: Uint8Array): ImageType | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  if (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a") return "gif";
  if (looksLikeSvg(b)) return "svg";
  return null;
}

function looksLikeSvg(b: Uint8Array): boolean {
  let head: string;
  try {
    head = new TextDecoder("utf-8", { fatal: true }).decode(b.subarray(0, Math.min(b.length, 4096)));
  } catch {
    // A multi-byte character split at the 4 KB boundary is fine; anything else is not UTF-8 text.
    try {
      head = new TextDecoder("utf-8", { fatal: true }).decode(b.subarray(0, Math.min(b.length, 4093)));
    } catch {
      return false;
    }
  }
  const rest = head
    .replace(/^﻿/, "")
    .replace(/^\s*<\?xml[^>]*\?>/, "")
    .replace(/^(\s*<!--[\s\S]*?-->)*/, "")
    .trimStart();
  return /^<svg[\s>]/i.test(rest);
}

export type UploadCheck =
  | { ok: true; type: ImageType; mime: string; ext: string; video?: undefined }
  | { ok: true; type: VideoType; mime: string; ext: string; video: VideoInfo }
  | {
      ok: false;
      code: "empty" | "too_large" | "executable" | "unsupported_type" | "type_mismatch" | "unsupported_video" | "unreadable_video" | "unsupported_codec" | "video_dimensions" | "video_too_long";
      message: string;
    };

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024) || 1;

/**
 * Check an upload before any processing: not empty, not executable, a known image or video type by magic bytes,
 * within its size limit (a video also within its container-level limits) and (when the browser declared one) not
 * pretending to be a different type.
 */
export function checkUpload(bytes: Uint8Array, declaredMime?: string | null): UploadCheck {
  if (!bytes.length) return { ok: false, code: "empty", message: "The file is empty." };
  const exe = executableKind(bytes);
  if (exe) return { ok: false, code: "executable", message: `Refused: the file is a ${exe}, not an image or video.` };
  const declared = declaredMime && declaredMime !== "application/octet-stream" ? declaredMime : null;

  const vtype = sniffVideoType(bytes);
  if (vtype) {
    if (bytes.length > MAX_VIDEO_BYTES) return { ok: false, code: "too_large", message: `Video clips may be at most ${mb(MAX_VIDEO_BYTES)} MB.` };
    const v = inspectVideo(bytes);
    if (!v.ok) return v;
    if (declared && declared !== VIDEO_MIME[vtype]) {
      return { ok: false, code: "type_mismatch", message: `The file says it is ${declared} but its contents are ${VIDEO_MIME[vtype]}.` };
    }
    return { ok: true, type: vtype, mime: VIDEO_MIME[vtype], ext: VIDEO_EXT[vtype], video: v.info };
  }

  const type = sniffImageType(bytes);
  if (!type) return { ok: false, code: "unsupported_type", message: "Only PNG, JPEG, WebP, GIF and SVG images, and WebM or MP4 video clips, are accepted." };
  if (bytes.length > MAX_BYTES[type]) {
    return { ok: false, code: "too_large", message: `${type.toUpperCase()} files may be at most ${mb(MAX_BYTES[type])} MB.` };
  }
  if (declared && declared !== MIME[type] && !(type === "jpeg" && declared === "image/jpg")) {
    return { ok: false, code: "type_mismatch", message: `The file says it is ${declared} but its contents are ${MIME[type]}.` };
  }
  return { ok: true, type, mime: MIME[type], ext: EXT[type] };
}

export function checkDimensions(width: number, height: number): string | null {
  if (!width || !height) return "The image has no readable size.";
  if (width < 16 || height < 16) return "Images must be at least 16 px on each side.";
  if (width > MAX_SIDE || height > MAX_SIDE) return `Images may be at most ${MAX_SIDE} px on a side.`;
  if (width * height > MAX_PIXELS) return "The image is too large (over 40 megapixels).";
  return null;
}

/** Widths of the WebP renditions for an image of this width: every standard width below it, and at least one. */
export function variantWidths(width: number): number[] {
  const ws: number[] = VARIANT_WIDTHS.filter((w) => w <= width);
  return ws.length ? ws : [width];
}

// ---------- Metadata ----------
export const MEDIA_CATEGORIES = ["background", "infographic", "map", "diagram", "manuscript", "calligraphy", "pattern", "landscape", "architecture", "object", "other"] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

const optText = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || v.length >= min, `at least ${min} characters`)
    .nullable()
    .optional();

/** Editable asset fields. Alt text (English) is required; Arabic and Urdu alt text and captions are optional. */
export const MediaMetadata = z.object({
  altText: z.string().trim().min(3, "Alt text is required (at least 3 characters).").max(500),
  altTextAr: optText(500, 3),
  altTextUr: optText(500, 3),
  captionEn: optText(500),
  captionAr: optText(500),
  captionUr: optText(500),
  category: z.enum(MEDIA_CATEGORIES),
  kind: z.enum(["image", "map", "manuscript", "video"]).default("image"),
  credit: z.string().trim().min(2, "Credit the source.").max(300),
  sourceId: z.string().uuid("Choose the source."),
  permissionId: z.string().uuid().nullable().optional(),
});
export type MediaMetadata = z.infer<typeof MediaMetadata>;

/**
 * Extra rules for a video clip (the database repeats them as a check constraint): the English description (alt text,
 * shown as the transcript-style text next to the player) is at least 20 characters and an English caption is given.
 */
export function videoMetadataProblem(m: Pick<MediaMetadata, "altText" | "captionEn">): string | null {
  if (m.altText.trim().length < MIN_VIDEO_DESCRIPTION) return `A video needs a description of at least ${MIN_VIDEO_DESCRIPTION} characters (what the clip shows, in words).`;
  if (!m.captionEn || m.captionEn.trim().length < 3) return "A video needs a caption (English).";
  return null;
}

/** The non-figurative confirmation the uploader ticks, item by item. All must be true. */
export const NON_FIGURATIVE_ITEMS = [
  ["noProphets", "It does not depict any prophet, Companion or member of the Ahl al-Bayt, in any form (face, figure, silhouette or light)."],
  ["noUnseen", "It does not depict angels, jinn, Iblis, Paradise, Hell or anything of the unseen."],
  ["noHumanFigures", "It shows no human figures in a religious scene."],
  ["noVeneration", "It does not present an object as belonging to a prophet or as an object of veneration."],
] as const;
/** The extra tick for a video clip, stored as the same non-figurative confirmation of the file version. */
export const VIDEO_CONFIRMATION = ["noVideoDepiction", "This clip depicts no prophet, angel, jinn or unseen being."] as const;
export const NonFigurativeConfirmation = z.object(
  Object.fromEntries(NON_FIGURATIVE_ITEMS.map(([k]) => [k, z.literal(true, { errorMap: () => ({ message: "Every confirmation is required." }) })])) as Record<
    (typeof NON_FIGURATIVE_ITEMS)[number][0],
    z.ZodLiteral<true>
  >,
).extend({ [VIDEO_CONFIRMATION[0]]: z.literal(true).optional() });

export function metadataToRow(m: MediaMetadata) {
  return {
    alt_text: m.altText,
    alt_text_ar: m.altTextAr ?? null,
    alt_text_ur: m.altTextUr ?? null,
    caption_en: m.captionEn ?? null,
    caption_ar: m.captionAr ?? null,
    caption_ur: m.captionUr ?? null,
    category: m.category,
    kind: m.kind,
    credit: m.credit,
    source_id: m.sourceId,
    permission_id: m.permissionId ?? null,
  };
}
