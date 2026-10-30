import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { ReportInput } from "@/lib/validation";

/** Report a comment or thread to the moderators. One report per person per item; throttled in the database. */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const r = await parseBody(req, ReportInput);
  if (isResponse(r)) return r;
  const { error } = await a.sb
    .from("reports")
    .insert({ reporter_id: a.user.id, target_type: r.targetType, target_id: r.targetId, reason: r.reason, details: r.details ?? null });
  if (error?.code === "23505") return json({ reported: true, duplicate: true });
  if (error) return dbError(error);
  return json({ reported: true }, 201);
}
