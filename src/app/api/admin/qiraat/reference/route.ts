import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("review"), kind: z.enum(["reader", "riwayah"]), id: z.string().regex(/^[a-z_]{2,40}$/), decision: z.enum(["approved", "changes_requested", "rejected"]), comment: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal("status"), kind: z.enum(["reader", "riwayah"]), id: z.string().regex(/^[a-z_]{2,40}$/), status: z.enum(["draft", "in_review", "published", "correction", "archived"]) }),
]);

/**
 * Review and publish the reference rows (the ten readers and twenty transmitters, which have text ids). A review is
 * recorded in editorial_reviews under public.qiraat_ref_uuid(kind, id); publishing is refused by the database without it.
 */
export async function POST(req: NextRequest) {
  const raw = (await req.clone().json().catch(() => ({}))) as { action?: string };
  const a = await requireRole(req, raw.action === "review" ? "scholarly_reviewer" : "editor");
  if (isResponse(a)) return a;
  const b = await parseBody(req, Body);
  if (isResponse(b)) return b;
  if (b.action === "review") {
    const { data: eid, error: e1 } = await a.sb.rpc("qiraat_ref_uuid", { kind: b.kind, ref: b.id });
    if (e1 || !eid) return dbError(e1);
    const { data, error } = await a.sb
      .from("editorial_reviews")
      .insert({ entity_type: b.kind === "reader" ? "qiraat_reader" : "qiraat_riwayah", entity_id: eid, reviewer_id: a.user.id, decision: b.decision, comment: b.comment ?? null })
      .select("id, created_at")
      .single();
    if (error) return dbError(error);
    return json({ review: data }, 201);
  }
  const { data, error } = await a.sb.from(b.kind === "reader" ? "qiraat" : "riwayat").update({ status: b.status }).eq("id", b.id).select("id, status").maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "Not found, or you cannot change it.");
  return json({ entity: data });
}
