import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { DREAM_NOTICE_VERSION, SecondOpinionInput } from "@/lib/dreams";
import { UUID_RE } from "@/lib/mufti";

/** Record consent to share with one more scholar, then ask for a second opinion on a released response. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, SecondOpinionInput);
  if (isResponse(b)) return b;
  const { error: e1 } = await a.sb
    .from("dream_request_consents")
    .insert({ request_id: id, user_id: a.user.id, kind: "second_opinion", granted: true, notice_version: DREAM_NOTICE_VERSION });
  if (e1) return dbError(e1);
  const { data, error } = await a.sb
    .from("dream_second_opinions")
    .insert({ request_id: id, first_response_id: b.firstResponseId, requested_by: a.user.id })
    .select("id")
    .single();
  if (error) return dbError(error);
  return json({ id: data.id }, 201);
}
