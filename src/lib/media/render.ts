import type { Locale } from "@/lib/i18n/dict";

/** Public rendering helpers for <MediaImage> (pure). Rows come from the media_public view only. */

export interface MediaVariant {
  w: number;
  h: number;
  name: string;
  bytes?: number;
}

export interface PublicMediaRow {
  id: string;
  kind: string;
  category: string;
  alt_text: string;
  alt_text_ar: string | null;
  alt_text_ur: string | null;
  caption_en: string | null;
  caption_ar: string | null;
  caption_ur: string | null;
  credit: string;
  file_id: string;
  version: number;
  storage_path: string;
  mime_type: string;
  width: number;
  height: number;
  variants: MediaVariant[];
  attribution: string | null;
  licence: string | null;
  license_url: string | null;
}

/** The folder of a file version (pending/<id> or assets/<id>). */
export const folderOf = (storagePath: string) => storagePath.slice(0, storagePath.lastIndexOf("/"));

export function publicObjectUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/media/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** The video types a published clip can have (the media_public view only lists these for kind video). */
export const VIDEO_MIME_TYPES = ["video/webm", "video/mp4"] as const;
export const isVideoRow = (row: Pick<PublicMediaRow, "mime_type">): boolean => (VIDEO_MIME_TYPES as readonly string[]).includes(row.mime_type);

/** The public URL and type of a published clip's file; null for anything still in pending/ or not a video. */
export function videoSource(supabaseUrl: string, row: Pick<PublicMediaRow, "storage_path" | "mime_type">): { url: string; type: string } | null {
  if (!isVideoRow(row) || !row.storage_path.startsWith("assets/")) return null;
  return { url: publicObjectUrl(supabaseUrl, row.storage_path), type: row.mime_type };
}

/** Variants sorted by width, each with its public URL. Only files outside pending/ have public URLs. */
export function variantUrls(supabaseUrl: string, row: Pick<PublicMediaRow, "storage_path" | "variants">): Array<{ w: number; h: number; url: string }> {
  if (!row.storage_path.startsWith("assets/")) return [];
  const folder = folderOf(row.storage_path);
  return [...row.variants]
    .filter((v) => /^w[0-9]{2,4}\.webp$/.test(v.name))
    .sort((a, b) => a.w - b.w)
    .map((v) => ({ w: v.w, h: v.h, url: publicObjectUrl(supabaseUrl, `${folder}/${v.name}`) }));
}

/** The smallest rendition at least as wide as asked, or the largest there is. */
export function pickVariant<T extends { w: number }>(variants: T[], width: number): T | undefined {
  const sorted = [...variants].sort((a, b) => a.w - b.w);
  return sorted.find((v) => v.w >= width) ?? sorted[sorted.length - 1];
}

/** Alt text in the reader's language, falling back to English (always present). */
export function altFor(row: Pick<PublicMediaRow, "alt_text" | "alt_text_ar" | "alt_text_ur">, locale: Locale): { text: string; lang: Locale } {
  if (locale === "ar" && row.alt_text_ar) return { text: row.alt_text_ar, lang: "ar" };
  if (locale === "ur" && row.alt_text_ur) return { text: row.alt_text_ur, lang: "ur" };
  return { text: row.alt_text, lang: "en" };
}

/** Caption in the reader's language, falling back to English; null when there is none. */
export function captionFor(row: Pick<PublicMediaRow, "caption_en" | "caption_ar" | "caption_ur">, locale: Locale): { text: string; lang: Locale } | null {
  if (locale === "ar" && row.caption_ar) return { text: row.caption_ar, lang: "ar" };
  if (locale === "ur" && row.caption_ur) return { text: row.caption_ur, lang: "ur" };
  return row.caption_en ? { text: row.caption_en, lang: "en" } : null;
}

/** The credit line: the credit, then the licence attribution when it says something more. */
export function creditLine(row: Pick<PublicMediaRow, "credit" | "attribution">): string {
  const parts = [row.credit.trim()];
  const attr = row.attribution?.trim();
  if (attr && !row.credit.includes(attr)) parts.push(attr);
  return parts.join(" · ");
}
