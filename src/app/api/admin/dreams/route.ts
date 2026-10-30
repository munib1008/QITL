import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { DreamAdminAction } from "@/lib/dreams";

/**
 * The administrator's dream queue: metadata only (dream_admin_queue never returns text), plus the dream-qualified
 * scholars who can be assigned.
 */
export async function GET(req: NextRequest) {
  const a = await requireRole(req, "admin", { mutation: false });
  if (isResponse(a)) return a;
  const [queue, scholars] = await Promise.all([
    a.sb.rpc("dream_admin_queue"),
    a.sb.from("mufti_profiles").select("user_id, display_name").not("dream_qualified_at", "is", null).eq("active", true).order("display_name"),
  ]);
  if (queue.error) return dbError(queue.error);
  if (scholars.error) return dbError(scholars.error);
  return json({ queue: queue.data, scholars: scholars.data });
}

export async function POST(req: NextRequest) {
  const a = await requireRole(req, "admin");
  if (isResponse(a)) return a;
  const b = await parseBody(req, DreamAdminAction);
  if (isResponse(b)) return b;
  const { error } =
    b.action === "assign"
      ? await a.sb.from("dream_request_assignments").insert({ request_id: b.requestId, scholar_id: b.scholarId, role: b.role, assigned_by: a.user.id })
      : b.action === "unassign"
        ? await a.sb.from("dream_request_assignments").delete().eq("request_id", b.requestId).eq("scholar_id", b.scholarId)
        : await a.sb.rpc("dream_admin_set_status", { p_request: b.requestId, p_status: b.status, p_reason: b.reason });
  if (error) return dbError(error);
  return json({ ok: true });
}
