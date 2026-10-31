import type { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { dbError, dbThrottle, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { ayahArabic, quranSource } from "@/content/quran";
import { DEFAULT_MODEL, PROMPT_VERSION, SYSTEM_PROMPT, buildDraftPrompt, checkDraft, inputsRecord, type DraftInputs } from "@/lib/interpretation/draft";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z
  .object({
    surah: z.number().int().min(1).max(114),
    ayahFrom: z.number().int().min(1).max(286),
    ayahTo: z.number().int().min(1).max(286),
    language: z.enum(["en", "ar", "ur"]),
    editionIds: z.array(z.string().uuid()).max(10).optional(),
    tafsirEditionIds: z.array(z.string().uuid()).max(10).optional(),
  })
  .refine((b) => b.ayahTo >= b.ayahFrom && b.ayahTo - b.ayahFrom < 20, { message: "ayah range must be ascending and at most 20 ayat" });

const CLEARED = new Set(["cleared", "public_domain"]);
type Ed = { id: string; title: string; registry_status: string; publication_year: number | null; translator_profiles: { name: string } | null; sources: { rights_status: string; license_text: string | null } | null };

/**
 * Editors: ask Claude for a DRAFT explanatory summary built only from stored, licensed sources. Off unless
 * ANTHROPIC_API_KEY is set. Saves the draft with origin 'ai_assisted', the model, the prompt version and the inputs;
 * it can publish only after the eight checks and a scholarly approval. Never a translation of its own.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const throttled = await dbThrottle(a.sb, "ai_draft");
  if (throttled) return throttled;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fail(503, "ai_not_configured", "AI-assisted drafting is off: ANTHROPIC_API_KEY is not set on this deployment.");
  const b = await parseBody(req, Body);
  if (isResponse(b)) return b;

  const src = quranSource();
  if (!src) return fail(422, "source_not_imported", "The verified Quran text is not imported, so there is nothing to explain from.");
  const arabic: DraftInputs["arabic"] = [];
  for (let ayah = b.ayahFrom; ayah <= b.ayahTo; ayah++) {
    const text = ayahArabic(b.surah, ayah);
    if (!text) return fail(404, "not_found", `Q ${b.surah}:${ayah} does not exist.`);
    arabic.push({ ayah, text });
  }

  // Only verified editions whose source licence is cleared: checked here explicitly, because staff can read more under RLS.
  const edSel = "id, title, registry_status, publication_year, translator_profiles(name), sources(rights_status, license_text)";
  const usable = (e: Ed) => e.registry_status === "verified" && Boolean(e.sources && CLEARED.has(e.sources.rights_status)) && Boolean(e.translator_profiles?.name);
  let tq = a.sb.from("quran_translations").select(`edition_id, ayah_no, text, translation_editions(${edSel})`).eq("surah_id", b.surah).gte("ayah_no", b.ayahFrom).lte("ayah_no", b.ayahTo).not("edition_id", "is", null);
  if (b.editionIds?.length) tq = tq.in("edition_id", b.editionIds);
  let fq = a.sb.from("tafsir_entries").select(`id, edition_id, ayah_from, ayah_to, text, flags, translation_editions(${edSel})`).eq("surah_id", b.surah).lte("ayah_from", b.ayahTo).gte("ayah_to", b.ayahFrom).not("edition_id", "is", null);
  if (b.tafsirEditionIds?.length) fq = fq.in("edition_id", b.tafsirEditionIds);
  const [tr, tf, wr] = await Promise.all([
    tq.limit(200),
    fq.limit(50),
    a.sb
      .from("quran_word_morphology")
      .select("ayah_no, word_no, text_ar, root, lemma, pos, literal_gloss, source_versions(sources(rights_status))")
      .eq("surah_id", b.surah)
      .gte("ayah_no", b.ayahFrom)
      .lte("ayah_no", b.ayahTo)
      .order("ayah_no")
      .order("word_no"),
  ]);
  if (tr.error) return dbError(tr.error);
  if (tf.error) return dbError(tf.error);

  const translations = ((tr.data ?? []) as unknown as Array<{ edition_id: string; ayah_no: number; text: string; translation_editions: Ed | null }>)
    .filter((r) => r.translation_editions && usable(r.translation_editions))
    .map((r) => {
      const e = r.translation_editions!;
      return { editionId: e.id, title: e.title, translator: e.translator_profiles!.name, year: e.publication_year, licence: e.sources!.license_text ?? e.sources!.rights_status, ayah: r.ayah_no, text: r.text };
    });
  const tafsir = ((tf.data ?? []) as unknown as Array<{ id: string; edition_id: string; ayah_from: number; ayah_to: number; text: string; flags: string[]; translation_editions: Ed | null }>)
    .filter((r) => r.translation_editions && usable(r.translation_editions))
    .map((r) => ({ editionId: r.edition_id, tafsirId: r.id, title: r.translation_editions!.title, scholar: r.translation_editions!.translator_profiles!.name, flags: r.flags ?? [], ayahFrom: r.ayah_from, ayahTo: r.ayah_to, text: r.text }));
  const words = ((wr.data ?? []) as unknown as Array<{ ayah_no: number; word_no: number; text_ar: string; root: string | null; lemma: string | null; pos: string; literal_gloss: string | null; source_versions: { sources: { rights_status: string } | null } | null }>)
    .filter((w) => CLEARED.has(w.source_versions?.sources?.rights_status ?? ""))
    .map((w) => ({ ayah: w.ayah_no, wordNo: w.word_no, textAr: w.text_ar, root: w.root, lemma: w.lemma, pos: w.pos, literalGloss: w.literal_gloss }));
  if (!translations.length && !tafsir.length)
    return fail(422, "no_licensed_inputs", "No verified, licence-cleared translation or tafsir is stored for this passage. A draft is never written from the Arabic alone.");

  const inputs: DraftInputs = { ref: { surah: b.surah, ayahFrom: b.ayahFrom, ayahTo: b.ayahTo }, language: b.language, arabic, arabicSource: { name: src.source, version: src.version, sha256: src.sha256 }, translations, tafsir, words };
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey: key });
  let text = "";
  try {
    // Server-side fallback: a declined request is retried on a fallback model chosen by the API.
    const msg = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildDraftPrompt(inputs) }],
    });
    if (msg.stop_reason === "refusal") return fail(422, "model_refused", "The model declined to draft this explanation.");
    text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return fail(429, "rate_limited", "The AI service is rate-limited. Try again shortly.");
    if (e instanceof Anthropic.APIError) return fail(502, "ai_error", `The AI service returned an error (${e.status ?? "network"}).`);
    throw e;
  }
  const checked = checkDraft(text);
  if (!checked.ok) return fail(422, "draft_rejected", checked.reason);

  const { data, error } = await a.sb
    .from("interpretation_explanations")
    .insert({
      surah_id: b.surah,
      ayah_from: b.ayahFrom,
      ayah_to: b.ayahTo,
      language: b.language,
      title: checked.title,
      body_md: checked.body,
      origin: "ai_assisted",
      model,
      prompt_version: PROMPT_VERSION,
      inputs: inputsRecord(inputs),
      status: "draft",
      created_by: a.user.id,
    })
    .select("id")
    .single();
  if (error) return dbError(error);
  return json({ id: (data as { id: string }).id, status: "draft", model, promptVersion: PROMPT_VERSION }, 201);
}
