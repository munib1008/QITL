import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";

const Review = z.object({
  entityType: z.enum(["shifa_topic", "shifa_entry", "shifa_safety_note", "shifa_link"]),
  entityId: z.string().uuid(),
  pathway: z.enum(["religious", "clinical"]),
  decision: z.enum(["approved", "changes_requested", "rejected"]),
  comment: z.string().trim().max(2000).optional(),
});

/**
 * Record one of the two Shifa reviews: religious (scholarly reviewer: Quran, hadith, scholarly notes, supplications,
 * ruqyah) or clinical (science reviewer: research, traditional use, every health statement and safety note). The database
 * binds the review to the version being reviewed, refuses the wrong role, a pathway the record does not need, and
 * self-review (the author of the record or of any of its layers).
 */
export async function POST(req: NextRequest) {
  const raw = await req.clone().json().catch(() => ({}));
  const role = (raw as { pathway?: string }).pathway === "clinical" ? "science_reviewer" : "scholarly_reviewer";
  const a = await requireRole(req, role);
  if (isResponse(a)) return a;
  const r = await parseBody(req, Review);
  if (isResponse(r)) return r;
  const { data, error } = await a.sb
    .from("shifa_reviews")
    .insert({ entity_type: r.entityType, entity_id: r.entityId, pathway: r.pathway, reviewer_id: a.user.id, decision: r.decision, comment: r.comment ?? null })
    .select("id, created_at, entity_version")
    .single();
  if (error) return dbError(error);
  return json({ review: data }, 201);
}
