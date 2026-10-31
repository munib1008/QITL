import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { AssignInput } from "@/lib/mufti";

/** Assign (or unassign) a verified mufti to an accepted question. The database refuses unverified muftis. */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "admin");
  if (isResponse(a)) return a;
  const b = await parseBody(req, AssignInput);
  if (isResponse(b)) return b;
  if (!b.assign) {
    const { error } = await a.sb.from("mufti_assignments").delete().eq("question_id", b.questionId).eq("mufti_id", b.muftiId);
    if (error) return dbError(error);
    return json({ ok: true });
  }
  const { error } = await a.sb.from("mufti_assignments").insert({ question_id: b.questionId, mufti_id: b.muftiId, assigned_by: a.user.id });
  if (error) return dbError(error);
  const { error: e2 } = await a.sb.from("mufti_questions").update({ status: "assigned" }).eq("id", b.questionId).eq("status", "accepted");
  if (e2) return dbError(e2);
  return json({ ok: true }, 201);
}
