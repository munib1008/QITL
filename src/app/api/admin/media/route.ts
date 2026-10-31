import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole, type Role } from "@/lib/admin";
import { getServiceSupabase } from "@/lib/supabase/server";
import { MediaMetadata, metadataToRow, NonFigurativeConfirmation } from "@/lib/media/validate";
import { getScanner } from "@/lib/media/scanner";
import { BUCKET, moveFile, swapRoot, type FileRow } from "@/lib/media/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const id = z.string().uuid();
const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), assetId: id, metadata: MediaMetadata }),
  z.object({ action: z.literal("confirm_non_figurative"), fileId: id, confirmation: NonFigurativeConfirmation }),
  z.object({ action: z.literal("submit"), assetId: id }),
  z.object({ action: z.literal("review"), fileId: id, decision: z.enum(["approved", "changes_requested", "rejected"]), comment: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal("acknowledge_scan"), fileId: id, acknowledgement: z.literal("scan skipped") }),
  z.object({ action: z.literal("rescan"), fileId: id }),
  z.object({ action: z.literal("approve"), assetId: id }),
  z.object({ action: z.literal("publish"), assetId: id }),
  z.object({ action: z.literal("activate_version"), assetId: id, fileId: id }),
  z.object({ action: z.literal("reject"), assetId: id }),
  z.object({ action: z.literal("reject_file"), fileId: id }),
  z.object({ action: z.literal("correction"), assetId: id }),
  z.object({ action: z.literal("withdraw"), assetId: id }),
]);
type Action = z.infer<typeof Action>;

const ROLE: Record<Action["action"], Role> = {
  update: "editor",
  confirm_non_figurative: "editor",
  submit: "editor",
  review: "scholarly_reviewer",
  acknowledge_scan: "admin",
  rescan: "editor",
  approve: "editor",
  publish: "editor",
  activate_version: "editor",
  reject: "editor",
  reject_file: "editor",
  correction: "editor",
  withdraw: "editor",
};

const FILE_COLS = "id, asset_id, version, storage_path, mime_type, variants, state, scan_status, non_figurative_confirmed, created_by";

/**
 * The Media Library workflow, one action per request. Each action is authorised here by role and again by RLS and
 * the database guards (scan results, approval stamps, publish rules, file states), which are the real locks.
 */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.clone().json();
  } catch {
    return fail(400, "bad_json", "The request body must be JSON.");
  }
  const pre = z.object({ action: z.string() }).safeParse(raw);
  const role = pre.success && pre.data.action in ROLE ? ROLE[pre.data.action as Action["action"]] : "editor";
  const a = await requireRole(req, role);
  if (isResponse(a)) return a;
  const act = await parseBody(req, Action);
  if (isResponse(act)) return act;
  const sb = a.sb;

  const file = async (fid: string) => {
    const { data, error } = await sb.from("asset_files").select(FILE_COLS).eq("id", fid).maybeSingle();
    return { f: data as FileRow | null, error };
  };
  const asset = async (aid: string) => {
    const { data, error } = await sb.from("assets").select("id, status, file_id").eq("id", aid).maybeSingle();
    return { row: data as { id: string; status: string; file_id: string | null } | null, error };
  };
  const setStatus = async (aid: string, status: string) => {
    const { data, error } = await sb.from("assets").update({ status }).eq("id", aid).select("id, status, approved_by").maybeSingle();
    if (error) return dbError(error);
    if (!data) return fail(404, "not_found", "Not found, or you cannot change it.");
    return json({ asset: data });
  };

  switch (act.action) {
    case "update": {
      const { data, error } = await sb.from("assets").update(metadataToRow(act.metadata)).eq("id", act.assetId).select("id").maybeSingle();
      if (error) return dbError(error);
      if (!data) return fail(404, "not_found", "Not found, or you cannot change it.");
      return json({ asset: data });
    }
    case "confirm_non_figurative": {
      // A video clip also needs the clip-specific tick (no prophet, angel, jinn or unseen being).
      const { f: target, error: terr } = await file(act.fileId);
      if (terr) return dbError(terr);
      if (target?.mime_type.startsWith("video/") && act.confirmation.noVideoDepiction !== true) {
        return fail(422, "confirmation_required", "Tick: this clip depicts no prophet, angel, jinn or unseen being.");
      }
      const { data, error } = await sb.from("asset_files").update({ non_figurative_confirmed: true }).eq("id", act.fileId).select("id, non_figurative_by, non_figurative_at").maybeSingle();
      if (error) return dbError(error);
      if (!data) return fail(404, "not_found", "No such file version.");
      return json({ file: data });
    }
    case "submit":
      return setStatus(act.assetId, "in_review");
    case "review": {
      const { data, error } = await sb
        .from("editorial_reviews")
        .insert({ entity_type: "media_file", entity_id: act.fileId, reviewer_id: a.user.id, decision: act.decision, comment: act.comment ?? null })
        .select("id, decision, created_at")
        .single();
      if (error) return dbError(error);
      return json({ review: data }, 201);
    }
    case "acknowledge_scan": {
      const { data, error } = await sb.from("asset_files").update({ scan_status: "skipped_acknowledged" }).eq("id", act.fileId).select("id, scan_status, scan_ack_by, scan_ack_at").maybeSingle();
      if (error) return dbError(error);
      if (!data) return fail(404, "not_found", "No such file version.");
      return json({ file: data });
    }
    case "rescan": {
      const scanner = getScanner();
      if (!scanner.configured) return fail(409, "no_scanner", "No malware scanner is configured (MALWARE_SCAN_URL). An admin may acknowledge the skipped scan instead.");
      const svc = getServiceSupabase();
      if (!svc) return fail(503, "not_configured", "Recording scan results needs SUPABASE_SERVICE_ROLE_KEY on the server.");
      const { f, error } = await file(act.fileId);
      if (error) return dbError(error);
      if (!f || f.state !== "pending") return fail(409, "not_pending", "Only a pending file version is rescanned.");
      const dl = await sb.storage.from(BUCKET).download(f.storage_path);
      if (dl.error || !dl.data) return fail(502, "storage_error", "The file could not be read from storage.");
      const bytes = new Uint8Array(await dl.data.arrayBuffer());
      const r = await scanner.scan(bytes, { sha256: createHash("sha256").update(bytes).digest("hex"), mime: f.mime_type });
      const status = r.status === "not_scanned" ? "failed" : r.status;
      const { error: uerr } = await svc.from("asset_files").update({ scan_status: status, scan_engine: r.engine, scanned_at: new Date().toISOString() }).eq("id", f.id);
      if (uerr) return dbError(uerr);
      if (status === "infected") {
        await sb.storage.from(BUCKET).remove([f.storage_path]);
        await sb.from("asset_files").update({ state: "rejected" }).eq("id", f.id);
      }
      return json({ file: { id: f.id, scan_status: status } });
    }
    case "approve":
      return setStatus(act.assetId, "approved");
    case "reject":
      return setStatus(act.assetId, "rejected");
    case "correction":
      return setStatus(act.assetId, "correction");
    case "reject_file": {
      const { data, error } = await sb.from("asset_files").update({ state: "rejected" }).eq("id", act.fileId).select("id, state").maybeSingle();
      if (error) return dbError(error);
      if (!data) return fail(404, "not_found", "No such file version.");
      return json({ file: data });
    }
    case "publish": {
      const { row, error } = await asset(act.assetId);
      if (error) return dbError(error);
      if (!row || !row.file_id) return fail(404, "not_found", "No such asset, or it has no file.");
      if (row.status !== "approved") return fail(409, "not_approved", "Approve the asset before publishing it.");
      const r = await activate(row.file_id);
      if (r) return r;
      return setStatus(row.id, "published");
    }
    case "activate_version": {
      const { row, error } = await asset(act.assetId);
      if (error) return dbError(error);
      if (!row) return fail(404, "not_found", "No such asset.");
      const { f } = await file(act.fileId);
      if (!f || f.asset_id !== row.id) return fail(404, "not_found", "No such file version of this asset.");
      if (row.status === "published" || row.status === "approved") {
        // A published or approved asset swaps only to a version that is ready to go public.
        const r = await activate(f.id);
        if (r) return r;
      } else if (row.file_id && row.file_id !== f.id) {
        // A draft simply points at the new version; the version it replaces is set aside for cleanup.
        const { f: prev } = await file(row.file_id);
        if (prev?.state === "pending") await sb.from("asset_files").update({ state: "rejected" }).eq("id", prev.id);
      }
      const { data, error: uerr } = await sb.from("assets").update({ file_id: f.id }).eq("id", row.id).select("id, file_id, storage_path").maybeSingle();
      if (uerr) return dbError(uerr);
      return json({ asset: data });
    }
    case "withdraw": {
      const { row, error } = await asset(act.assetId);
      if (error) return dbError(error);
      if (!row) return fail(404, "not_found", "No such asset.");
      const res = await setStatus(row.id, "archived");
      if (res.status !== 200 || !row.file_id) return res;
      // Take the files out of the public folder again.
      const { f } = await file(row.file_id);
      if (f?.state === "active") {
        const { error: uerr } = await sb.from("asset_files").update({ state: "pending", storage_path: swapRoot(f.storage_path, "pending") }).eq("id", f.id);
        if (uerr) return dbError(uerr);
        const m = await moveFile(sb, f, "pending");
        if (!m.ok) {
          await sb.from("asset_files").update({ state: "active", storage_path: f.storage_path }).eq("id", f.id);
          return fail(502, "storage_error", "The asset is archived, but its files could not be moved back to pending/.");
        }
      }
      return res;
    }
  }

  /** Move a ready file version to assets/ and mark it active (storage first: the policy checks readiness too). */
  async function activate(fid: string) {
    const { f, error } = await file(fid);
    if (error) return dbError(error);
    if (!f) return fail(404, "not_found", "No such file version.");
    if (f.state === "active") return null;
    if (f.state !== "pending") return fail(409, "not_pending", `A ${f.state} file version cannot go public.`);
    const m = await moveFile(sb, f, "assets");
    if (!m.ok) return fail(409, "not_ready", "The file cannot go public yet: it needs a resolved scan, the non-figurative confirmation, an approving religious review and an approved asset.");
    const { error: uerr } = await sb.from("asset_files").update({ state: "active", storage_path: swapRoot(f.storage_path, "assets") }).eq("id", f.id);
    if (uerr) {
      await moveFile(sb, { ...f, storage_path: swapRoot(f.storage_path, "assets") }, "pending");
      return dbError(uerr);
    }
    return null;
  }
}
