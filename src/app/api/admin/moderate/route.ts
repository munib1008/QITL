import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";

const Action = z.object({
  targetType: z.enum(["comment", "discussion"]),
  targetId: z.string().uuid(),
  action: z.enum(["hide", "remove", "restore", "dismiss_reports", "lock"]),
  reason: z.enum(["misleading", "disrespectful", "spam", "personal_information", "other", "appeal_upheld"]),
});

/** Open reports, oldest first, grouped by target. */
export async function GET(req: NextRequest) {
  const a = await requireRole(req, "moderator", { mutation: false });
  if (isResponse(a)) return a;
  const { data, error } = await a.sb.from("reports").select("id, target_type, target_id, reason, details, created_at").eq("status", "open").order("created_at").limit(200);
  if (error) return dbError(error);
  return json({ reports: data });
}

/** Apply a moderation decision. The database applies it, resolves the reports and logs it in one transaction. */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "moderator");
  if (isResponse(a)) return a;
  const b = await parseBody(req, Action);
  if (isResponse(b)) return b;
  const { error } = await a.sb.rpc("moderate", { p_target_type: b.targetType, p_target_id: b.targetId, p_action: b.action, p_reason: b.reason });
  if (error) return dbError(error);
  return json({ ok: true });
}
