import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";

const Review = z.object({
  entityType: z.enum(["claim", "story", "chapter", "event", "relationship", "place_geometry", "person", "story_section", "quiz", "media", "guidance_topic", "guidance_lesson", "guidance_link", "guidance_safety_note", "creation"]),
  entityId: z.string().uuid(),
  decision: z.enum(["approved", "changes_requested", "rejected"]),
  comment: z.string().trim().max(2000).optional(),
});

/** Record a scholarly review. The database refuses non-reviewers and self-review of one's own claim. */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "scholarly_reviewer");
  if (isResponse(a)) return a;
  const r = await parseBody(req, Review);
  if (isResponse(r)) return r;
  const { data, error } = await a.sb
    .from("editorial_reviews")
    .insert({ entity_type: r.entityType, entity_id: r.entityId, reviewer_id: a.user.id, decision: r.decision, comment: r.comment ?? null })
    .select("id, created_at")
    .single();
  if (error) return dbError(error);
  return json({ review: data }, 201);
}
