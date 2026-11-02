import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { TransitionInput } from "@/lib/partners/validation";

/**
 * Move a listing along its status path. The same function serves providers (submit, take offline) and staff
 * (start review, request information or changes, suspend; ONLY an administrator approves or rejects). The database
 * function partner_transition() decides who may do what and refuses a listing's own members as its judges, so this
 * route holds no authorisation logic of its own.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Not found.");
  const b = await parseBody(req, TransitionInput);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb.rpc("partner_transition", { p_partner: id.data, p_to: b.to, p_note: b.note ?? null });
  if (error) return error.code === "42501" ? fail(403, "forbidden", error.message) : error.code === "P0002" ? fail(404, "not_found", "Not found.") : dbError(error);
  return json({ ok: true, status: data });
}
