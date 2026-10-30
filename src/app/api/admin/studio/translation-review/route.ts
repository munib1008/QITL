import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { TranslationReview } from "@/lib/production/schemas";

/**
 * Review a translated script at its current version. Linguistic and terminology reviews are signed by a translation
 * reviewer, the religious review by a scholarly reviewer (RLS reviewer_insert enforces the same split).
 */
export async function POST(req: NextRequest) {
  const peek = (await req
    .clone()
    .json()
    .catch(() => null)) as { aspect?: string } | null;
  const a = await requireRole(req, peek?.aspect === "religious" ? "scholarly_reviewer" : "translation_reviewer");
  if (isResponse(a)) return a;
  const b = await parseBody(req, TranslationReview);
  if (isResponse(b)) return b;
  const { data: s } = await a.sb.from("story_scripts").select("id, version, translated_from").eq("id", b.scriptId).maybeSingle();
  if (!s) return fail(404, "not_found", "Script not found.");
  if (!s.translated_from) return fail(422, "rule", "This script is not a translation.");
  const { data, error } = await a.sb
    .from("translation_reviews")
    .insert({ translated_script_id: s.id, script_version: s.version, aspect: b.aspect, decision: b.decision, reviewer_id: a.user.id, comment: b.comment ?? null })
    .select("id, aspect, decision, script_version, created_at")
    .single();
  if (error) return dbError(error);
  return json({ review: data }, 201);
}
