import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { folderOf, type MediaVariant } from "./render";

/** Storage moves for the Media Library, as the acting user (the storage policies decide what is allowed). */

export const BUCKET = "media";

export interface FileRow {
  id: string;
  asset_id: string;
  version: number;
  storage_path: string;
  mime_type: string;
  variants: MediaVariant[];
  state: string;
  scan_status: string;
  non_figurative_confirmed: boolean;
  created_by: string | null;
}

/** Every object of a file version: the original and its renditions. */
export function objectNames(f: Pick<FileRow, "storage_path" | "variants">): string[] {
  const folder = folderOf(f.storage_path);
  return [f.storage_path, ...f.variants.map((v) => `${folder}/${v.name}`)];
}

export function swapRoot(path: string, to: "pending" | "assets"): string {
  return path.replace(/^(pending|assets)\//, `${to}/`);
}

/**
 * Move all objects of a file version between pending/ and assets/. On a failure the objects already moved are moved
 * back, so a version is never left half public.
 */
export async function moveFile(sb: SupabaseClient, f: Pick<FileRow, "storage_path" | "variants">, to: "pending" | "assets"): Promise<{ ok: true } | { ok: false; error: string }> {
  const moved: Array<[string, string]> = [];
  for (const from of objectNames(f)) {
    const dest = swapRoot(from, to);
    if (dest === from) continue;
    const { error } = await sb.storage.from(BUCKET).move(from, dest);
    if (error) {
      for (const [a, b] of moved.reverse()) await sb.storage.from(BUCKET).move(b, a);
      return { ok: false, error: error.message };
    }
    moved.push([from, dest]);
  }
  return { ok: true };
}
