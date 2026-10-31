import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { DreamResponsePatch } from "@/lib/dreams";
import { UUID_RE } from "@/lib/mufti";

/** Edit, submit, release or withdraw the caller's response. Release needs an independent review and the acknowledgement. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, DreamResponsePatch);
  if (isResponse(b)) return b;
  const patch: Record<string, unknown> = {};
  if (b.outcome) patch.outcome = b.outcome;
  if (b.body) patch.body_md = b.body;
  if (b.status) patch.status = b.status;
  if (b.acknowledged) patch.fallibility_acknowledged = true;
  const { data, error } = await a.sb
    .from("dream_scholar_responses")
    .update(patch)
    .eq("id", id)
    .eq("scholar_id", a.user.id)
    .select("id, status, review_status, version");
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ response: data[0] });
}
