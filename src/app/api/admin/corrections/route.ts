import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { requireRole } from "@/lib/admin";

const Submit = z.object({
  entityType: z.string().regex(/^[a-z_]{3,40}$/),
  entityId: z.string().min(1).max(120),
  body: z.string().trim().min(10).max(5000),
  evidence: z.string().trim().max(2000).optional(),
});
const Resolve = z.object({
  id: z.string().uuid(),
  status: z.enum(["accepted", "rejected", "duplicate"]),
  resolutionNote: z.string().trim().min(3).max(2000),
});

/** Staff: the open correction queue. */
export async function GET(req: NextRequest) {
  const a = await requireRole(req, "editor", { mutation: false });
  if (isResponse(a)) return a;
  const { data, error } = await a.sb.from("correction_requests").select("*").eq("status", "open").order("created_at").limit(200);
  if (error) return dbError(error);
  return json({ corrections: data });
}

/** Anyone signed in may report an error in the content. */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const s = await parseBody(req, Submit);
  if (isResponse(s)) return s;
  const { error } = await a.sb
    .from("correction_requests")
    .insert({ entity_type: s.entityType, entity_id: s.entityId, body: s.body, evidence: s.evidence ?? null, submitted_by: a.user.id });
  if (error) return dbError(error);
  return json({ submitted: true }, 201);
}

/** Staff resolve a request. Changing the content itself goes through /api/admin/status with a revision note. */
export async function PATCH(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const r = await parseBody(req, Resolve);
  if (isResponse(r)) return r;
  const { error } = await a.sb
    .from("correction_requests")
    .update({ status: r.status, resolution_note: r.resolutionNote, resolved_by: a.user.id, resolved_at: new Date().toISOString() })
    .eq("id", r.id);
  if (error) return dbError(error);
  return json({ resolved: true });
}
