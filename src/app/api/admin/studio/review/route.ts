import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { ScriptReview } from "@/lib/production/schemas";

/**
 * Script workflow. request: an editor sends a draft to the scholarly review queue (status in_review).
 * decide: a scholarly reviewer records a decision (editorial_reviews, entity 'story_script').
 * publish: an editor publishes; the database refuses unless every scene has approved claims and the latest scholarly
 * review approves (guard_script_publish), and for a translation, both translation reviews approve this version.
 */
export async function POST(req: NextRequest) {
  const peek = await req.clone().json().catch(() => null) as { action?: string } | null;
  const a = await requireRole(req, peek?.action === "decide" ? "scholarly_reviewer" : "editor");
  if (isResponse(a)) return a;
  const b = await parseBody(req, ScriptReview);
  if (isResponse(b)) return b;
  if (b.action === "decide") {
    const { data, error } = await a.sb
      .from("editorial_reviews")
      .insert({ entity_type: "story_script", entity_id: b.scriptId, reviewer_id: a.user.id, decision: b.decision, comment: b.comment ?? null })
      .select("id, decision, created_at")
      .single();
    if (error) return dbError(error);
    return json({ review: data }, 201);
  }
  const status = b.action === "request" ? "in_review" : "published";
  const { data, error } = await a.sb.from("story_scripts").update({ status }).eq("id", b.scriptId).select("id, status, version").maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "Not found, or you cannot change it.");
  return json({ script: data });
}
