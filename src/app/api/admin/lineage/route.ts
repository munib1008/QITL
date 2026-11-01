import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";

/**
 * Workflow for the lineage module and the scripture witness registry: gap nodes, person claims and witnesses.
 * Every action is also enforced by the database (RLS, publish guards, no self-review); this route only authenticates,
 * validates and forwards. Link (relationship) status and review use the generic /api/admin/status and /api/admin/review.
 *   action "review"      a scholarly review (scholarly_reviewer)
 *   action "historical"  the historical/scientific review of a scripture witness (science_reviewer)
 *   action "status"      move an entry between draft, in_review, approved, published, correction, archived (editor)
 */
const TABLE = { lineage_gap: "lineage_gaps", lineage_node_claim: "lineage_node_claims", scripture_witness: "scripture_witnesses" } as const;
const Type = z.enum(["lineage_gap", "lineage_node_claim", "scripture_witness"]);

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("review"), entityType: Type, entityId: z.string().uuid(), decision: z.enum(["approved", "changes_requested", "rejected"]), comment: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal("historical"), entityId: z.string().uuid(), decision: z.enum(["approved", "changes_requested", "rejected"]), comment: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal("status"), entityType: Type, entityId: z.string().uuid(), status: z.enum(["draft", "in_review", "approved", "published", "correction", "archived"]), revisionNote: z.string().trim().max(2000).optional() }),
]);

export async function POST(req: NextRequest) {
  const b = await parseBody(req, Body);
  if (isResponse(b)) return b;

  if (b.action === "review") {
    const a = await requireRole(req, "scholarly_reviewer");
    if (isResponse(a)) return a;
    const { data, error } = await a.sb
      .from("editorial_reviews")
      .insert({ entity_type: b.entityType, entity_id: b.entityId, reviewer_id: a.user.id, decision: b.decision, comment: b.comment ?? null })
      .select("id, created_at")
      .single();
    if (error) return dbError(error);
    return json({ review: data }, 201);
  }

  if (b.action === "historical") {
    const a = await requireRole(req, "science_reviewer");
    if (isResponse(a)) return a;
    const { data, error } = await a.sb
      .from("scripture_historical_reviews")
      .insert({ witness_id: b.entityId, reviewer_id: a.user.id, decision: b.decision, comment: b.comment ?? null })
      .select("id, created_at")
      .single();
    if (error) return dbError(error);
    return json({ review: data }, 201);
  }

  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  if (b.status === "correction" && !b.revisionNote) return fail(422, "note_required", "A correction needs a public revision note.");
  const { data, error } = await a.sb.from(TABLE[b.entityType]).update({ status: b.status }).eq("id", b.entityId).select("id, status").maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "Not found, or you cannot change it.");
  if (b.revisionNote) {
    const { error: e2 } = await a.sb
      .from("revision_notes")
      .insert({ entity_type: b.entityType, entity_id: b.entityId, note: b.revisionNote, is_correction: b.status === "correction", public: true, created_by: a.user.id });
    if (e2) return dbError(e2);
  }
  return json({ entity: data });
}
