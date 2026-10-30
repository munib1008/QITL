/**
 * AI-assisted DRAFTS of a QITL Explanatory Summary. Pure helpers (prompt + output guard), unit-tested; the route in
 * src/app/api/admin/interpretation/draft calls Claude only when ANTHROPIC_API_KEY is set.
 *
 * The model is given ONLY stored, licensed sources (the pinned Arabic, verified + cleared translation and tafsir
 * editions, licensed morphology) and is asked to explain them, never to translate. The result is saved as a draft
 * (origin 'ai_assisted', with model, prompt version and the exact inputs) and cannot publish until all eight checks
 * pass and a scholar approves (database rule, migration 20261031001200).
 */

export const PROMPT_VERSION = "interp-draft-v1";
export const DEFAULT_MODEL = "claude-opus-5-5";

export interface DraftInputs {
  ref: { surah: number; ayahFrom: number; ayahTo: number };
  language: "en" | "ar" | "ur";
  arabic: { ayah: number; text: string }[];
  arabicSource: { name: string; version: string; sha256: string };
  translations: Array<{ editionId: string; title: string; translator: string; year: number | null; licence: string; ayah: number; text: string }>;
  tafsir: Array<{ editionId: string; tafsirId: string; title: string; scholar: string; flags: string[]; ayahFrom: number; ayahTo: number; text: string }>;
  words: Array<{ ayah: number; wordNo: number; textAr: string; root: string | null; lemma: string | null; pos: string; literalGloss: string | null }>;
}

const LANG = { en: "English", ar: "Arabic", ur: "Urdu" } as const;

export const SYSTEM_PROMPT = `You draft explanatory notes for QITL, a public Islamic knowledge site. A qualified scholar and editors will check every line before anything is published.

What you write is an EXPLANATION of the sources you are given, never a translation:
- Do not translate the Arabic yourself, and do not produce a new, merged, averaged, "best" or "most accurate" translation. Quote translations only word for word from the inputs, always naming the edition.
- Explain why the given translations differ. Label each difference with exactly one kind and keep the kinds apart: translation choice (a translator's wording), linguistic (meaning of a word or root), grammatical (a syntactic reading), or exegetical (a recognised disagreement among the scholars of tafsir). Never merge or resolve a recognised scholarly disagreement; present each position with its source.
- Use only the inputs. Do not add hadith, reports, dates, names or claims that are not in them. If the inputs are not enough to explain something, say so.
- Where a tafsir input is flagged (weak narration, Isra'iliyyat, disputed, unattributed), say so whenever you use it.
- Give no legal rulings (fatwa); refer such questions to qualified scholars.
- Write for a general reader, plainly, in Markdown. Start with one line "# <short title>", then the explanation, then a "Sources used" list naming each edition or work you drew on.`;

export function buildDraftPrompt(inp: DraftInputs): string {
  const r = inp.ref;
  const ref = r.ayahFrom === r.ayahTo ? `Q ${r.surah}:${r.ayahFrom}` : `Q ${r.surah}:${r.ayahFrom}-${r.ayahTo}`;
  const parts: string[] = [];
  parts.push(`Draft an explanatory note in ${LANG[inp.language]} for ${ref}.`);
  parts.push(`<arabic source="${inp.arabicSource.name}" version="${inp.arabicSource.version}">\n${inp.arabic.map((a) => `${r.surah}:${a.ayah} ${a.text}`).join("\n")}\n</arabic>`);
  for (const t of inp.translations)
    parts.push(`<translation edition="${t.title}" translator="${t.translator}" year="${t.year ?? "not recorded"}" ayah="${r.surah}:${t.ayah}">\n${t.text}\n</translation>`);
  for (const t of inp.tafsir)
    parts.push(`<tafsir work="${t.title}" scholar="${t.scholar}" range="${r.surah}:${t.ayahFrom}-${t.ayahTo}" flags="${t.flags.join(",") || "none"}">\n${t.text}\n</tafsir>`);
  if (inp.words.length)
    parts.push(`<words>\n${inp.words.map((w) => `${r.surah}:${w.ayah}:${w.wordNo} ${w.textAr} root=${w.root ?? "-"} lemma=${w.lemma ?? "-"} pos=${w.pos} gloss=${w.literalGloss ?? "-"}`).join("\n")}\n</words>`);
  return parts.join("\n\n");
}

/** The inputs record saved with the draft, so reviewers can see exactly what the model was given. */
export function inputsRecord(inp: DraftInputs) {
  return {
    arabic_source: inp.arabicSource,
    edition_ids: [...new Set(inp.translations.map((t) => t.editionId))],
    tafsir_edition_ids: [...new Set(inp.tafsir.map((t) => t.editionId))],
    tafsir_ids: inp.tafsir.map((t) => t.tafsirId),
    word_count: inp.words.length,
  };
}

const FORBIDDEN = [
  /most accurate (?:translation|rendering|meaning)/i,
  /\baverag(?:e|ed|ing)\b[^.\n]{0,40}\btranslation/i,
  /\b(?:combined|merged|composite|definitive|best|correct) translation\b/i,
  /\bQITL(?:'s)? (?:own )?translation\b/i,
];

/** Refuses output that presents itself as a translation of its own (averaged, "most accurate", combined...). */
export function checkDraft(text: string): { ok: true; title: string; body: string } | { ok: false; reason: string } {
  const body = text.trim();
  if (body.length < 40) return { ok: false, reason: "The draft is empty or too short." };
  const hit = FORBIDDEN.find((re) => re.test(body));
  if (hit) return { ok: false, reason: "The draft presents its own or an averaged translation, which QITL never publishes." };
  const title = /^#\s+(.+)$/m.exec(body)?.[1]?.trim().slice(0, 200) ?? "Draft explanation";
  return { ok: true, title, body };
}
