import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { DREAM_NOTICE_VERSION, DreamSubmit } from "@/lib/dreams";

/** The caller's own dream requests: metadata only (the text is shown on the request's own page). */
export async function GET(req: NextRequest) {
  const a = await requireUser(req, { mutation: false });
  if (isResponse(a)) return a;
  const { data, error } = await a.sb
    .from("dream_requests")
    .select("id, status, language, created_at, retain_until")
    .eq("user_id", a.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return dbError(error);
  return json({ requests: data });
}

/**
 * Submit a private request with its scholar-access consent, in one database transaction. The body is never logged;
 * the schema is strict, so no profile field (age, gender, marital status, health) can be sent.
 */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, DreamSubmit);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb.rpc("submit_dream_request", {
    p_dream_text: b.dream,
    p_question: b.question ?? "",
    p_language: b.language,
    p_notice_version: DREAM_NOTICE_VERSION,
  });
  if (error) return dbError(error);
  return json({ id: data as string }, 201);
}
