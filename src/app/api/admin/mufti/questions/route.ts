import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { ModerateQuestionInput } from "@/lib/mufti";

const NEXT = { accept: "accepted", reject: "rejected", close: "closed" } as const;

/** Moderate a question: accept it for assignment, reject it, or close it. Moderators and administrators only. */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "moderator");
  if (isResponse(a)) return a;
  const b = await parseBody(req, ModerateQuestionInput);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb
    .from("mufti_questions")
    .update({ status: NEXT[b.action], moderation_note: b.note ?? null })
    .eq("id", b.questionId)
    .select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ ok: true });
}
