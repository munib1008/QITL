import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { MessageInput } from "@/lib/partners/validation";

/** Add a message to an inquiry thread: the learner, or the provider's inquiry-authorised members. Throttled in the database. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Not found.");
  const b = await parseBody(req, MessageInput);
  if (isResponse(b)) return b;
  const { error } = await a.sb.from("partner_inquiry_messages").insert({ inquiry_id: id.data, body: b.body });
  if (error) return dbError(error);
  return json({ ok: true }, 201);
}
