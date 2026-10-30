import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { DRAFT_MODEL, DRAFT_PROMPT_VERSION, draftConfigured, requestDraft, sanitizeDraft, type DraftClaim } from "@/lib/production/draft";
import { DraftRequest } from "@/lib/production/schemas";

export const maxDuration = 300;

interface ClaimRow {
  id: string;
  statement: string;
  evidence: string;
  status: string;
  claim_references: Array<{ kind: string; quran_surah: number | null; quran_ayah_from: number | null; quran_ayah_to: number | null; locator: string | null }> | null;
}

/**
 * Optional Claude-assisted first draft (only when ANTHROPIC_API_KEY is set). The model receives only the approved
 * claims the editor chose; scenes link only those claims; unsupported statements are marked in the text. The script
 * is saved as a DRAFT with origin 'ai_assisted', the model and the prompt version.
 */
export async function POST(req: NextRequest) {
  if (!draftConfigured()) return fail(503, "not_configured", "Claude-assisted drafting is not configured (ANTHROPIC_API_KEY).");
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const b = await parseBody(req, DraftRequest);
  if (isResponse(b)) return b;

  const { data: claims, error: e1 } = await a.sb
    .from("evidence_claims")
    .select("id, statement, evidence, status, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, locator)")
    .in("id", b.claimIds)
    .in("status", ["approved", "published"]);
  if (e1) return dbError(e1);
  const rows = (claims ?? []) as ClaimRow[];
  if (!rows.length) return fail(422, "rule", "None of the chosen claims is approved.");
  const subjectTable = b.personId ? "people" : "historical_events";
  const { data: subj } = await a.sb
    .from(subjectTable)
    .select(b.personId ? "name_en" : "title")
    .eq("id", (b.personId ?? b.eventId)!)
    .maybeSingle();
  const subject = (subj as { name_en?: string; title?: string } | null)?.name_en ?? (subj as { title?: string } | null)?.title ?? "Unknown subject";
  const input: DraftClaim[] = rows.map((c) => ({
    id: c.id,
    statement: c.statement,
    evidence: c.evidence,
    refs: (c.claim_references ?? []).map((r) =>
      r.kind === "quran" && r.quran_surah ? `Quran ${r.quran_surah}:${r.quran_ayah_from}${r.quran_ayah_to && r.quran_ayah_to !== r.quran_ayah_from ? `-${r.quran_ayah_to}` : ""}` : `${r.kind}${r.locator ? ` ${r.locator}` : ""}`,
    ),
  }));

  const res = await requestDraft({ subject, language: b.language, audience: b.audience, title: b.title, claims: input });
  if (!res.ok) return fail(res.reason === "refusal" ? 422 : 502, `draft_${res.reason}`, res.message);
  const scenes = sanitizeDraft(res.draft, new Set(rows.map((r) => r.id)));

  const { data: script, error: e2 } = await a.sb
    .from("story_scripts")
    .insert({
      person_id: b.personId ?? null,
      event_id: b.eventId ?? null,
      language: b.language,
      audience: b.audience,
      title: b.title,
      origin: "ai_assisted",
      model: DRAFT_MODEL,
      prompt_version: DRAFT_PROMPT_VERSION,
      status: "draft",
      created_by: a.user.id,
    })
    .select("id")
    .single();
  if (e2) return dbError(e2);
  const { data: saved, error: e3 } = await a.sb
    .from("story_scenes")
    .insert(scenes.map((s) => ({ script_id: script.id, position: s.position, scene_kind: s.scene_kind, step_role: s.step_role, title: s.title, narration_text: s.narration_text, lessons: s.lessons })))
    .select("id, position");
  if (e3) return dbError(e3);
  const byPos = new Map((saved ?? []).map((s: { id: string; position: number }) => [s.position, s.id]));
  const links = scenes.flatMap((s) => s.claim_ids.map((claim_id) => ({ scene_id: byPos.get(s.position)!, claim_id })));
  if (links.length) {
    const { error: e4 } = await a.sb.from("scene_claim_references").insert(links);
    if (e4) return dbError(e4);
  }
  return json({ script: { id: script.id, status: "draft", origin: "ai_assisted" }, unsupported: scenes.reduce((n, s) => n + s.unsupported, 0) }, 201);
}
