import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { AnswerPatch, UUID_RE } from "@/lib/mufti";

/**
 * Edit, submit, publish or withdraw the caller's answer. Publishing needs a citation and an approved independent
 * review of the current version; an edit sends it back for review. The database enforces all of it.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, AnswerPatch);
  if (isResponse(b)) return b;
  const patch: Record<string, unknown> = {};
  if (b.body !== undefined) patch.body_md = b.body;
  if (b.status !== undefined) patch.status = b.status;
  const { data, error } = await a.sb.from("mufti_answers").update(patch).eq("id", id).eq("mufti_id", a.user.id).select("id, status, review_status, version");
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ answer: data[0] });
}
