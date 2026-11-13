import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, json, parseBody } from "@/lib/api";
import { requireAnyRole, requireRole } from "@/lib/admin";
import { checkScienceText } from "@/lib/science/validator";
import { EVIDENCE_STATES } from "@/lib/science/model";

const Id = z.string().uuid();
const Decision = z.enum(["approved", "changes_requested", "rejected"]);

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("integrity"), id: Id }),
  z.object({ action: z.literal("publish_ai"), id: Id }),
  z.object({ action: z.literal("withdraw"), id: Id, reason: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("status"), id: Id, status: z.enum(["in_review", "published", "correction"]) }),
  z.object({ action: z.literal("review_scientific"), id: Id, decision: Decision, scope: z.enum(["overall", "evidence_state", "citations", "dates"]).default("overall"), comment: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal("review_scholarly"), id: Id, decision: Decision, scope: z.enum(["overall", "interpretation", "relationship"]).default("overall"), comment: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal("verify_publication"), id: Id, source: z.string().url().max(500), note: z.string().trim().min(5).max(600) }),
  z.object({ action: z.literal("assess"), claim_id: Id, state: z.enum(EVIDENCE_STATES), rationale: z.string().trim().min(10).max(2000), basis_url: z.string().url().max(500).optional() }),
]);

/**
 * Console actions. Every one is authorised again by the database: the integrity check, AI-draft display, withdrawal and status
 * changes need an editor; the scientific review, citation verification and evidence-state assessment need an appointed science
 * reviewer; the scholarly review needs an appointed scholarly reviewer. The two reviews are separate routes and separate tables, a
 * review is recorded in the signed-in reviewer's own name, and publishing needs both (two different people). Nothing here sets a
 * rating from the client except through the reviewer's recorded assessment.
 */
export async function POST(req: NextRequest) {
  const raw = (await req.clone().json().catch(() => ({}))) as { action?: string };
  const a =
    raw.action === "review_scholarly"
      ? await requireRole(req, "scholarly_reviewer")
      : raw.action === "review_scientific" || raw.action === "verify_publication" || raw.action === "assess"
        ? await requireRole(req, "science_reviewer")
        : await requireAnyRole(req, ["editor", "admin"]);
  if (isResponse(a)) return a;
  const b = await parseBody(req, Body);
  if (isResponse(b)) return b;

  switch (b.action) {
    case "integrity": {
      const { data, error } = await a.sb.rpc("run_science_integrity", { p_id: b.id });
      return error ? dbError(error) : json({ result: data });
    }
    case "publish_ai": {
      const { error } = await a.sb.rpc("publish_science_ai_draft", { p_id: b.id });
      return error ? dbError(error) : json({ ok: true });
    }
    case "withdraw": {
      const { error } = await a.sb.rpc("withdraw_science_topic", { p_id: b.id, p_reason: b.reason ?? null });
      return error ? dbError(error) : json({ ok: true });
    }
    case "status": {
      const { error } = await a.sb.from("science_topics").update({ status: b.status }).eq("id", b.id);
      return error ? dbError(error) : json({ ok: true });
    }
    case "review_scientific": {
      const { data, error } = await a.sb.from("science_expert_reviews").insert({ topic_id: b.id, reviewer_id: a.user.id, decision: b.decision, scope: b.scope, comment: b.comment ?? null }).select("id, topic_version").single();
      return error ? dbError(error) : json({ review: data }, 201);
    }
    case "review_scholarly": {
      const { data, error } = await a.sb.from("science_scholarly_reviews").insert({ topic_id: b.id, reviewer_id: a.user.id, decision: b.decision, scope: b.scope, comment: b.comment ?? null }).select("id, topic_version").single();
      return error ? dbError(error) : json({ review: data }, 201);
    }
    case "verify_publication": {
      const bad = checkScienceText(b.note);
      if (bad.length) return dbError({ message: `The note breaks the content guard: ${bad.join(", ")}` });
      const { error } = await a.sb.from("science_publications").update({ verified: true, verified_source: b.source, verified_note: b.note }).eq("id", b.id);
      return error ? dbError(error) : json({ ok: true });
    }
    case "assess": {
      const { data, error } = await a.sb
        .from("science_claim_assessments")
        .insert({ claim_id: b.claim_id, evidence_state: b.state, rationale: b.rationale, basis_url: b.basis_url ?? null, assessor_id: a.user.id })
        .select("id")
        .single();
      return error ? dbError(error) : json({ assessment: data }, 201);
    }
  }
}
