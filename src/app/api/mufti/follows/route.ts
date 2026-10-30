import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { QuestionFollowInput } from "@/lib/mufti";

/** Follow or unfollow a question the reader can see (the database checks visibility). */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const f = await parseBody(req, QuestionFollowInput);
  if (isResponse(f)) return f;
  const { error } = f.follow
    ? await a.sb.from("mufti_question_follows").upsert({ user_id: a.user.id, question_id: f.questionId }, { ignoreDuplicates: true })
    : await a.sb.from("mufti_question_follows").delete().eq("question_id", f.questionId).eq("user_id", a.user.id);
  if (error) return dbError(error);
  return json({ following: f.follow });
}
