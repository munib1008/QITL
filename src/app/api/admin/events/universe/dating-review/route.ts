import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";

const Review = z.object({ eventId: z.string().uuid(), decision: z.enum(["approved", "changes_requested", "rejected"]), comment: z.string().trim().max(2000).optional() });

/**
 * The historical/scientific review of a historians' dated estimate (class C): the named publication, the dating
 * method and the "historians' estimate" label. Separate from the scholarly review; the database refuses the event's
 * author and anyone who is not a science reviewer (or admin).
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "science_reviewer");
  if (isResponse(a)) return a;
  const r = await parseBody(req, Review);
  if (isResponse(r)) return r;
  const { data, error } = await a.sb
    .from("event_dating_reviews")
    .insert({ event_id: r.eventId, reviewer_id: a.user.id, decision: r.decision, comment: r.comment ?? null })
    .select("id, created_at")
    .single();
  if (error) return dbError(error);
  return json({ review: data }, 201);
}
