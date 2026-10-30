import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { ReviewInput } from "@/lib/mufti";

/** Record an independent review of one answer version. The database refuses a review of one's own answer. */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const r = await parseBody(req, ReviewInput);
  if (isResponse(r)) return r;
  const { error } = await a.sb.from("mufti_answer_reviews").insert({
    answer_id: r.answerId,
    answer_version: r.version,
    reviewer_id: a.user.id,
    decision: r.decision,
    note: r.note ?? null,
  });
  if (error) return dbError(error);
  return json({ ok: true }, 201);
}
