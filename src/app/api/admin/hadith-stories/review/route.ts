import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";

const Review = z.object({
  storyId: z.string().uuid(),
  decision: z.enum(["approved", "changes_requested", "rejected"]),
  comment: z.string().trim().max(2000).optional(),
});

/**
 * Record the scholarly (hadith authenticity) review of a hadith story. The database binds it to the version being reviewed,
 * refuses anyone but a scholarly reviewer, and refuses the author of the story or of any part.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "scholarly_reviewer");
  if (isResponse(a)) return a;
  const r = await parseBody(req, Review);
  if (isResponse(r)) return r;
  const { data, error } = await a.sb
    .from("hadith_story_reviews")
    .insert({ story_id: r.storyId, reviewer_id: a.user.id, decision: r.decision, comment: r.comment ?? null })
    .select("id, created_at, story_version")
    .single();
  if (error) return dbError(error);
  return json({ review: data }, 201);
}
