import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { DREAM_NOTICE_VERSION, DreamDelete, DreamPatch } from "@/lib/dreams";
import { UUID_RE } from "@/lib/mufti";

/** The submitter withdraws or closes a request, shortens its retention, or withdraws / restores scholar access. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, DreamPatch);
  if (isResponse(b)) return b;
  if (b.scholarAccess !== undefined) {
    const { error } = await a.sb
      .from("dream_request_consents")
      .insert({ request_id: id, user_id: a.user.id, kind: "scholar_access", granted: b.scholarAccess, notice_version: DREAM_NOTICE_VERSION });
    if (error) return dbError(error);
  }
  if (b.status !== undefined || b.retainUntil !== undefined) {
    const patch: Record<string, unknown> = {};
    if (b.status) patch.status = b.status;
    if (b.retainUntil) patch.retain_until = b.retainUntil;
    const { data, error } = await a.sb.from("dream_requests").update(patch).eq("id", id).eq("user_id", a.user.id).select("id");
    if (error) return dbError(error);
    if (!data?.length) return fail(404, "not_found", "Not found.");
  }
  return json({ ok: true });
}

/** Permanently delete a request; its consents, assignments, responses, references and history cascade with it. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, DreamDelete);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb.from("dream_requests").delete().eq("id", id).eq("user_id", a.user.id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ deleted: true });
}
