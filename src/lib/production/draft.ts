import "server-only";
import { z } from "zod/v4";
import { SCENE_KINDS, SCENE_STEP_ROLES } from "@/lib/player/types";

/**
 * Optional Claude-assisted first drafts. Available only when ANTHROPIC_API_KEY is set. The model sees only the
 * approved claims the editor linked, must cite them per scene, and must mark anything it cannot support. The result
 * is saved as a DRAFT with origin 'ai_assisted', the model and the prompt version, and goes through the same scholarly
 * review as any human draft: it can never publish by itself (guard_script_publish).
 */
export const DRAFT_MODEL = "claude-opus-5-5";
export const DRAFT_PROMPT_VERSION = "studio-draft-v1";
export const UNSUPPORTED_MARK = "[UNSUPPORTED: ";

export function draftConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

export interface DraftClaim {
  id: string;
  statement: string;
  evidence: string;
  refs: string[];
}

export const DraftSchema = z.object({
  scenes: z
    .array(
      z.object({
        kind: z.enum(SCENE_KINDS),
        step_role: z.enum(SCENE_STEP_ROLES).nullable(),
        title: z.string(),
        narration_text: z.string(),
        lessons: z.array(z.string()),
        claim_ids: z.array(z.string()),
        unsupported: z.array(z.string()),
      }),
    )
    .min(1)
    .max(40),
});
export type Draft = z.infer<typeof DraftSchema>;

export const DRAFT_SYSTEM = `You draft story scripts for QITL, an Islamic knowledge platform. A scholar reviews every draft before anything is published.

Write the script as scenes of these kinds, in this order: world, central_issue, message, sequence (one scene per step, each with a step_role of situation, challenge, action, response or consequence), turning_point, outcome, lessons, explore. Kinds other than sequence have step_role null.

Use ONLY the claims supplied in the user message. Every scene except explore lists in claim_ids the ids of the claims its narration rests on, using ids exactly as given. Do not quote Quran or hadith wording, and do not add names, numbers, dates, ages, places, lineage or events that the claims do not state. If a scene needs a statement the claims do not support, write it inside the narration as ${UNSUPPORTED_MARK}...] and also list it in that scene's unsupported array, so the editor can remove it or find evidence. Never describe the physical appearance of any prophet, Companion or member of the Ahl al-Bayt. Use ﷺ after the name of the Prophet Muhammad and (عليه السلام) after other prophets. Keep each narration under 900 words, in plain, calm prose suited to the requested audience and language.`;

export function draftUserPrompt(input: { subject: string; language: string; audience: string; title: string; claims: DraftClaim[] }): string {
  const claims = input.claims.map((c) => `- id: ${c.id}\n  evidence: ${c.evidence}\n  statement: ${c.statement}\n  references: ${c.refs.join("; ") || "none listed"}`).join("\n");
  return `Subject: ${input.subject}\nScript title: ${input.title}\nLanguage: ${input.language}\nAudience: ${input.audience}\n\nApproved claims:\n${claims}`;
}

/** Keep only claim ids the editor supplied, make sure unsupported statements are marked in the text, and trim to the database limits. */
export function sanitizeDraft(d: Draft, allowed: Set<string>) {
  return d.scenes.slice(0, 40).map((s, i) => {
    let text = s.narration_text.trim();
    for (const u of s.unsupported.map((x) => x.trim()).filter(Boolean)) if (!text.includes(u)) text += `\n\n${UNSUPPORTED_MARK}${u}]`;
    if (!text) text = `${UNSUPPORTED_MARK}empty scene]`;
    return {
      position: i + 1,
      scene_kind: s.kind,
      step_role: s.kind === "sequence" ? s.step_role : null,
      title: (s.title.trim() || s.kind).slice(0, 200),
      narration_text: text.slice(0, 5000),
      lessons: s.lessons.map((l) => l.trim()).filter(Boolean).slice(0, 12),
      claim_ids: [...new Set(s.claim_ids.filter((id) => allowed.has(id)))],
      unsupported: s.unsupported.length,
    };
  });
}

export type DraftResult = { ok: true; draft: Draft } | { ok: false; reason: "refusal" | "invalid" | "error"; message: string };

export async function requestDraft(input: Parameters<typeof draftUserPrompt>[0]): Promise<DraftResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 300_000 });
  try {
    const res = await client.beta.messages.parse({
      model: DRAFT_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(DraftSchema) },
      system: DRAFT_SYSTEM,
      messages: [{ role: "user", content: draftUserPrompt(input) }],
    });
    if (res.stop_reason === "refusal") return { ok: false, reason: "refusal", message: "The model declined to draft this script." };
    if (!res.parsed_output) return { ok: false, reason: "invalid", message: "The model's draft did not match the scene format." };
    return { ok: true, draft: res.parsed_output };
  } catch (e) {
    if (e instanceof Anthropic.APIError) return { ok: false, reason: "error", message: `Drafting service error (${e.status ?? "network"}).` };
    return { ok: false, reason: "error", message: "Drafting failed." };
  }
}
