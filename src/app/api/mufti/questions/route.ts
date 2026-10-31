import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { AskInput } from "@/lib/mufti";

/** The signed-in reader's own questions, newest first (any status, public or private). */
export async function GET(req: NextRequest) {
  const a = await requireUser(req, { mutation: false });
  if (isResponse(a)) return a;
  const { data, error } = await a.sb
    .from("mufti_questions")
    .select("id, title, status, visibility, created_at")
    .eq("asker_id", a.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return dbError(error);
  return json({ questions: data });
}

/** Ask a question. It starts as 'submitted' and is visible to nobody else until a moderator accepts it. */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const q = await parseBody(req, AskInput);
  if (isResponse(q)) return q;
  const { data, error } = await a.sb
    .from("mufti_questions")
    .insert({
      asker_id: a.user.id,
      title: q.title,
      body: q.body,
      visibility: q.visibility,
      topic_type: q.topicType ?? null,
      topic_ref: q.topicRef ?? null,
    })
    .select("id")
    .single();
  if (error) return dbError(error);
  await a.sb.from("mufti_question_follows").upsert({ user_id: a.user.id, question_id: data.id }, { ignoreDuplicates: true });
  return json({ id: data.id }, 201);
}
