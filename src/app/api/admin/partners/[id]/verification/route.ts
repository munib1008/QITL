import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAnyRole } from "@/lib/admin";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { VerificationDecisionInput } from "@/lib/partners/validation";

/**
 * Decide one kind of verification (identity, qualifications or religious/scholarly) for a listing. Each is separate; none
 * implies another. Moderators decide identity and qualifications; religious/scholarly is an administrator's decision,
 * and nobody decides a listing they are a member of. The database function enforces all of it and records the decision.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAnyRole(req, ["moderator", "admin"]);
  if (isResponse(a)) return a;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Not found.");
  const b = await parseBody(req, VerificationDecisionInput);
  if (isResponse(b)) return b;
  const { error } = await a.sb.rpc("partner_decide_verification", { p_partner: id.data, p_kind: b.kind, p_status: b.status, p_note: b.note ?? null, p_scope: b.scope ?? null });
  if (error) return error.code === "42501" ? fail(403, "forbidden", error.message) : error.code === "P0002" ? fail(404, "not_found", "Not found.") : dbError(error);
  return json({ ok: true });
}
