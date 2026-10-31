import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { AnswerCreate } from "@/lib/mufti";

/** Start an answer. The database accepts it only from a verified mufti assigned to the question. */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, AnswerCreate);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb
    .from("mufti_answers")
    .insert({ question_id: b.questionId, mufti_id: a.user.id, body_md: b.body, status: b.submit ? "submitted" : "draft" })
    .select("id")
    .single();
  if (error) return dbError(error);
  return json({ id: data.id }, 201);
}
