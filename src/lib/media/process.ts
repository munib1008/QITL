import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { checkDimensions, checkUpload, MAX_PIXELS, variantWidths, type MediaType } from "./validate";
import { sanitizeSvg, SvgRejected } from "./svg";

/**
 * Turn an accepted upload into what is stored: a re-encoded original (metadata such as EXIF/GPS stripped, anything
 * appended after the image dropped; SVG sanitised) and responsive WebP renditions. Nothing here touches storage.
 * A video clip (WebM or MP4) is validated from its container headers and stored byte for byte: there is no transcoding,
 * no metadata stripping and no poster or rendition (no ffmpeg), so `variants` is empty.
 */

export interface ProcessedVariant {
  w: number;
  h: number;
  name: string;
  bytes: number;
  data: Buffer;
}

export interface ProcessedImage {
  type: MediaType;
  mime: string;
  ext: string;
  original: Buffer;
  sha256: string;
  width: number;
  height: number;
  sanitised: boolean;
  removed: string[];
  variants: ProcessedVariant[];
  /** Video only: seconds from the container headers, null when unreadable (or an image). */
  durationSeconds: number | null;
}

export class UploadRejected extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const sharpOpts = (animated: boolean) => ({ limitInputPixels: MAX_PIXELS, failOn: "error" as const, animated });

export async function processUpload(bytes: Uint8Array, declaredMime?: string | null): Promise<ProcessedImage> {
  const check = checkUpload(bytes, declaredMime);
  if (!check.ok) throw new UploadRejected(check.code, check.message);
  const { type, mime, ext } = check;
  if (check.video) {
    const original = Buffer.from(bytes);
    return {
      type,
      mime,
      ext,
      original,
      sha256: createHash("sha256").update(original).digest("hex"),
      width: check.video.width,
      height: check.video.height,
      sanitised: false,
      removed: [],
      variants: [],
      durationSeconds: check.video.durationSeconds,
    };
  }
  let original: Buffer;
  let sanitised = false;
  let removed: string[] = [];
  try {
    if (type === "svg") {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const s = sanitizeSvg(text);
      original = Buffer.from(s.svg, "utf8");
      sanitised = true;
      removed = s.removed;
    } else if (type === "gif") {
      original = await sharp(bytes, sharpOpts(true)).gif().toBuffer();
    } else {
      const img = sharp(bytes, sharpOpts(false)).rotate();
      original = await (type === "png" ? img.png({ compressionLevel: 9 }) : type === "jpeg" ? img.jpeg({ quality: 90, mozjpeg: true }) : img.webp({ quality: 90 })).toBuffer();
    }
  } catch (e) {
    if (e instanceof SvgRejected) throw new UploadRejected("svg_rejected", `The SVG cannot be made safe: ${e.message}.`);
    if (e instanceof TypeError) throw new UploadRejected("svg_rejected", "The SVG is not valid UTF-8 text.");
    throw new UploadRejected("unreadable", "The image could not be read (corrupt, truncated or too large).");
  }

  let width: number, height: number;
  try {
    const meta = await sharp(original, sharpOpts(false)).metadata();
    width = meta.width ?? 0;
    height = meta.pageHeight ?? meta.height ?? 0;
  } catch {
    throw new UploadRejected("unreadable", "The image could not be read (corrupt, truncated or too large).");
  }
  const dim = checkDimensions(width, height);
  if (dim) throw new UploadRejected("dimensions", dim);

  const variants: ProcessedVariant[] = [];
  for (const w of variantWidths(width)) {
    const { data, info } = await sharp(original, { ...sharpOpts(false), density: type === "svg" ? 144 : undefined })
      .resize({ width: w, withoutEnlargement: type !== "svg" })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    variants.push({ w: info.width, h: info.height, name: `w${w}.webp`, bytes: data.length, data });
  }
  return {
    type,
    mime,
    ext,
    original,
    sha256: createHash("sha256").update(original).digest("hex"),
    width,
    height,
    sanitised,
    removed,
    variants,
    durationSeconds: null,
  };
}
