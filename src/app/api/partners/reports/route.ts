import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { ReportInput } from "@/lib/partners/validation";

/** A learner's report of a provider. Only the reporter and staff can read it; the provider is never told who reported. */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, ReportInput);
  if (isResponse(b)) return b;
  const { error } = await a.sb.from("partner_reports").insert({ partner_id: b.partner_id, reason: b.reason, details: b.details });
  if (error) return dbError(error);
  return json({ ok: true }, 201);
}
