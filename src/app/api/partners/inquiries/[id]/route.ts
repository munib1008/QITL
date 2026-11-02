import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { InquiryStatusInput } from "@/lib/partners/validation";

/** Move an inquiry's status. A provider's inquiry managers set viewed / answered / follow up / closed / spam; a learner can only close. The trigger enforces it. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Not found.");
  const b = await parseBody(req, InquiryStatusInput);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb.from("partner_inquiries").update({ status: b.status }).eq("id", id.data).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ ok: true });
}
