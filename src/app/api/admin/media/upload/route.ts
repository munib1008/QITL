import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { getServiceSupabase } from "@/lib/supabase/server";
import { MediaMetadata, metadataToRow, videoMetadataProblem } from "@/lib/media/validate";
import { processUpload, UploadRejected } from "@/lib/media/process";
import { getScanner } from "@/lib/media/scanner";
import { BUCKET } from "@/lib/media/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hard ceiling before anything is read into memory (the per-type limits are lower). */
const MAX_REQUEST_BYTES = 11 * 1024 * 1024;

/**
 * Upload an image or a short video clip (editors only): a new asset with its metadata, or a new file version of an
 * existing asset (`assetId`). The file type comes from its magic bytes; SVG is sanitised; rasters are re-encoded; WebP
 * renditions are generated. A WebM/MP4 clip (8 MB, 20 s when readable) is checked from its container headers and stored
 * unchanged (no transcoding, no poster); it needs a description and a caption. The upload is scanned when MALWARE_SCAN_URL is set (an infected file is refused and nothing is
 * stored); otherwise it stays unscanned in the private pending/ folder until an admin acknowledges the skipped scan.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_REQUEST_BYTES) return fail(413, "too_large", "The upload is larger than 10 MB.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "bad_form", "Send the file as multipart/form-data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail(422, "no_file", "Choose a file to upload.");
  if (file.size > MAX_REQUEST_BYTES) return fail(413, "too_large", "The upload is larger than 10 MB.");

  const assetIdRaw = form.get("assetId");
  const assetId = assetIdRaw ? z.string().uuid().safeParse(assetIdRaw) : null;
  if (assetId && !assetId.success) return fail(422, "invalid", "The asset id is not valid.");

  let meta: MediaMetadata | null = null;
  if (!assetId) {
    let raw: unknown;
    try {
      raw = JSON.parse(String(form.get("metadata") ?? "{}"));
    } catch {
      return fail(422, "invalid", "The metadata is not valid JSON.");
    }
    const m = MediaMetadata.safeParse(raw);
    if (!m.success) return fail(422, "invalid", m.error.issues.map((i) => `${i.path.join(".") || "metadata"}: ${i.message}`).join("; "), m.error.flatten());
    meta = m.data;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let img;
  try {
    img = await processUpload(bytes, file.type || null);
  } catch (e) {
    if (e instanceof UploadRejected) return fail(422, e.code, e.message);
    console.error("[media] processing failed");
    return fail(422, "unreadable", "The image could not be processed.");
  }

  // Scan what the uploader sent (before anything is stored). Infected: refuse, store nothing.
  const isVideo = img.mime.startsWith("video/");
  if (meta) {
    if (isVideo) {
      const problem = videoMetadataProblem(meta);
      if (problem) return fail(422, "invalid", problem);
      meta = { ...meta, kind: "video" };
    } else if (meta.kind === "video") {
      return fail(422, "invalid", "The kind is video, but the file is not a video.");
    }
  }

  const scanner = getScanner();
  const scan = await scanner.scan(bytes, { sha256: img.sha256, mime: img.mime });
  if (scan.status === "infected") {
    return fail(422, "infected", "The malware scanner flagged this file. It was not stored.");
  }

  const fileId = randomUUID();
  const original = `pending/${fileId}/original.${img.ext}`;
  let newAssetId: string | null = null;
  if (meta) {
    const { data, error } = await a.sb
      .from("assets")
      .insert({ ...metadataToRow(meta), storage_path: original, mime_type: img.mime, bytes: img.original.length, status: "draft", depicts_person: false })
      .select("id")
      .single();
    if (error) return dbError(error);
    newAssetId = data.id as string;
  } else {
    const { data, error } = await a.sb.from("assets").select("id, status, kind").eq("id", assetId!.data!).maybeSingle();
    if (error) return dbError(error);
    if (!data) return fail(404, "not_found", "No such asset.");
    if ((data.kind === "video") !== isVideo) {
      return fail(422, "kind_mismatch", data.kind === "video" ? "This asset is a video clip; its new version must be a WebM or MP4 clip." : "This asset is an image; its new version must be an image.");
    }
  }
  const target = newAssetId ?? assetId!.data!;

  const { data: frow, error: ferr } = await a.sb
    .from("asset_files")
    .insert({
      id: fileId,
      asset_id: target,
      version: 1, // the database numbers versions
      storage_path: original,
      mime_type: img.mime,
      bytes: img.original.length,
      sha256: img.sha256,
      width: img.width,
      height: img.height,
      sanitised: img.sanitised,
      variants: img.variants.map(({ w, h, name, bytes: b }) => ({ w, h, name, bytes: b })),
    })
    .select("id, version")
    .single();
  if (ferr) {
    if (newAssetId) await a.sb.from("assets").update({ status: "rejected" }).eq("id", newAssetId);
    return dbError(ferr);
  }

  const store = a.sb.storage.from(BUCKET);
  const uploads: Array<[string, Buffer, string]> = [[original, img.original, img.mime], ...img.variants.map((v): [string, Buffer, string] => [`pending/${fileId}/${v.name}`, v.data, "image/webp"])];
  for (const [path, data, contentType] of uploads) {
    const { error } = await store.upload(path, data, { contentType, upsert: false, cacheControl: "31536000" });
    if (error) {
      await store.remove(uploads.map(([p]) => p));
      await a.sb.from("asset_files").update({ state: "rejected" }).eq("id", fileId);
      if (newAssetId) await a.sb.from("assets").update({ status: "rejected" }).eq("id", newAssetId);
      console.error("[media] storage upload failed");
      return fail(502, "storage_error", "The file could not be stored. Nothing was published; try again.");
    }
  }
  if (newAssetId) {
    const { error } = await a.sb.from("assets").update({ file_id: fileId }).eq("id", newAssetId);
    if (error) return dbError(error);
  }

  // Scan results are written by the server only (the database refuses them from editors).
  let scanRecorded: string = scan.status;
  if (scan.status === "clean" || scan.status === "failed") {
    const svc = getServiceSupabase();
    if (svc) {
      const { error } = await svc.from("asset_files").update({ scan_status: scan.status, scan_engine: scan.engine, scanned_at: new Date().toISOString() }).eq("id", fileId);
      if (error) scanRecorded = "not_recorded";
    } else {
      scanRecorded = "not_recorded";
    }
  }

  return json(
    {
      assetId: target,
      fileId: frow.id,
      version: frow.version,
      scan: scanRecorded,
      scannerConfigured: scanner.configured,
      sanitised: img.sanitised,
      removed: img.removed,
      width: img.width,
      height: img.height,
      type: img.type,
      durationSeconds: img.durationSeconds,
      variants: img.variants.map((v) => v.w),
    },
    201,
  );
}
