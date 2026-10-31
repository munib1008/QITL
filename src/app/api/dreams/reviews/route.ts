import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { DreamReviewInput } from "@/lib/dreams";

/** An assigned scholar reviews another scholar's submitted response (never their own; the database enforces it). */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const r = await parseBody(req, DreamReviewInput);
  if (isResponse(r)) return r;
  const { error } = await a.sb.from("dream_content_reviews").insert({
    response_id: r.responseId,
    response_version: r.version,
    reviewer_id: a.user.id,
    decision: r.decision,
    note: r.note ?? null,
  });
  if (error) return dbError(error);
  return json({ ok: true }, 201);
}
