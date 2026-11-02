import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAnyRole } from "@/lib/admin";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { ReportDecisionInput } from "@/lib/partners/validation";

/** Handle a report of a provider: open to reviewing to actioned or dismissed. Staff only; audited by the database. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAnyRole(req, ["moderator", "admin"]);
  if (isResponse(a)) return a;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Not found.");
  const b = await parseBody(req, ReportDecisionInput);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb.from("partner_reports").update({ status: b.status, ...(b.note ? { decision_note: b.note } : {}) }).eq("id", id.data).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ ok: true });
}
