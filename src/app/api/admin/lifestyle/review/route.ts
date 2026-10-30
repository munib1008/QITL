import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { RECORD_TYPE_KEYS, type RecordType } from "@/lib/lifestyle/model";

const Review = z.object({
  entityType: z.enum(RECORD_TYPE_KEYS as [RecordType, ...RecordType[]]),
  entityId: z.string().uuid(),
  pathway: z.enum(["religious", "scientific"]),
  decision: z.enum(["approved", "changes_requested", "rejected"]),
  comment: z.string().trim().max(2000).optional(),
});

/**
 * Record one of the two Life Through the Ages reviews: religious (scholarly reviewer, classes A/B) or
 * historical/scientific (science reviewer, classes C/D). The database refuses the wrong role and self-review.
 */
export async function POST(req: NextRequest) {
  const raw = await req.clone().json().catch(() => ({}));
  const role = (raw as { pathway?: string }).pathway === "scientific" ? "science_reviewer" : "scholarly_reviewer";
  const a = await requireRole(req, role);
  if (isResponse(a)) return a;
  const r = await parseBody(req, Review);
  if (isResponse(r)) return r;
  const { data, error } = await a.sb
    .from("lifestyle_reviews")
    .insert({ entity_type: r.entityType, entity_id: r.entityId, pathway: r.pathway, reviewer_id: a.user.id, decision: r.decision, comment: r.comment ?? null })
    .select("id, created_at")
    .single();
  if (error) return dbError(error);
  return json({ review: data }, 201);
}
