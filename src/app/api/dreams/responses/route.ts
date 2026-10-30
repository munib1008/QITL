import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { DreamResponseCreate } from "@/lib/dreams";

/** A qualified scholar assigned to the request starts a response (the database checks assignment and consent). */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, DreamResponseCreate);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb
    .from("dream_scholar_responses")
    .insert({
      request_id: b.requestId,
      scholar_id: a.user.id,
      outcome: b.outcome,
      body_md: b.body,
      second_opinion_id: b.secondOpinionId ?? null,
      status: b.submit ? "submitted" : "draft",
    })
    .select("id")
    .single();
  if (error) return dbError(error);
  return json({ id: data.id }, 201);
}
