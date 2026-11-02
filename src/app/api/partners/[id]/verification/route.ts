import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { VerificationRequestInput } from "@/lib/partners/validation";

/** Ask staff to verify one thing: identity, qualifications or religious/scholarly standing. Each is separate. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Not found.");
  const b = await parseBody(req, VerificationRequestInput);
  if (isResponse(b)) return b;
  const { error } = await a.sb.rpc("partner_request_verification", { p_partner: id.data, p_kind: b.kind });
  if (error) return dbError(error);
  return json({ ok: true }, 201);
}
