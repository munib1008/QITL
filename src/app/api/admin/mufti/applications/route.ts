import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { DecideApplicationInput } from "@/lib/mufti-apply";

/**
 * Move a scholar application: submitted to under review, then verified or declined. Administrators only. This changes
 * the application and nothing else: it never grants the mufti role and never verifies a profile (those stay the
 * separate actions of /api/admin/mufti/verify). The database refuses any other path and any edit of the submission.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "admin");
  if (isResponse(a)) return a;
  const b = await parseBody(req, DecideApplicationInput);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb
    .from("mufti_applications")
    .update({ status: b.status, ...(b.note ? { decision_note: b.note } : {}) })
    .eq("id", b.id)
    .select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ ok: true });
}
