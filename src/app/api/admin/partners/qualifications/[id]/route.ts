import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAnyRole } from "@/lib/admin";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { QualificationReviewInput } from "@/lib/partners/validation";

/** Verify, reject or reset one stated qualification. Staff only; never a member of the listing. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAnyRole(req, ["moderator", "admin"]);
  if (isResponse(a)) return a;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Not found.");
  const b = await parseBody(req, QualificationReviewInput);
  if (isResponse(b)) return b;
  const { error } = await a.sb.rpc("partner_review_qualification", { p_qualification: id.data, p_status: b.status, p_note: b.note ?? null });
  if (error) return error.code === "42501" ? fail(403, "forbidden", error.message) : error.code === "P0002" ? fail(404, "not_found", "Not found.") : dbError(error);
  return json({ ok: true });
}
