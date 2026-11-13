import { z } from "zod";

/**
 * The generic "sourced draft" field: written from the Quran ONLY, as an AI draft pending review. A field is either STATED with
 * at least one Quran reference that supports it, or NOT ESTABLISHED with a short note. Nothing is padded. Used by the Creation
 * Atlas profiles (content/creation) and the Life Guidance lessons (content/guidance); "How They Lived" (content/lifestyle) has
 * the same shape and rules in src/lib/lifestyle/draft.ts.
 */
export const INTERPRETATION_PREFIX = "Educational interpretation (not scripture):";

export const Ref = z.object({ surah: z.number().int().min(1).max(114), from: z.number().int().min(1), to: z.number().int().min(1) });
export type SourcedRef = z.infer<typeof Ref>;

export const SourcedField = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("stated"),
    text_en: z.string().min(20).max(520),
    refs: z.array(Ref).min(1),
    /** Digits allowed in text_en, each one stated in a cited verse. */
    numbers: z.array(z.string().regex(/^\d+$/)).optional(),
  }),
  z.object({ status: z.literal("not_established"), note_en: z.string().min(10).max(260) }),
]);
export type SourcedField = z.infer<typeof SourcedField>;

/** An invented detail: a place, date, dress, appearance, number or custom the Quran does not state. A reviewer can lift one with a source; a draft cannot. */
const INVENTED = /\b(wore|ate|lived in a|tent of|robe|sandals|village of|city of|born in|died in|year \d{3,4}|bc|bce|ad\b|ce\b|looks? like|appearance of|made of fire and|giant|handsome|beautiful face|tall)\b/i;
const OVERCLAIM = /\bscience (will|has proven)|proved? that|guarantee|always works|cures? (all|every)|certain(ly)? (will|to) (be )?(answered|healed|cured)/i;
/** Quran-only drafts do not cite hadith or later tradition. */
const OFF_SOURCE = /\b(hadith|narrated|narration|tradition holds|according to (some|many) scholars|isra'?iliyy?at|midrash|talmud|bible)\b/i;

export interface SourcedProblem {
  field?: string;
  message: string;
}

/**
 * Check every key's field: shape, verses that exist, declared numbers, no invented details, no overclaims, no off-source
 * wording, and the interpretation label on exactly the interpretive keys.
 */
export function checkSourcedFields(
  fields: Record<string, SourcedField>,
  hasAyah: (surah: number, ayah: number) => boolean,
  interpretiveKeys: readonly string[] = [],
): SourcedProblem[] {
  const problems: SourcedProblem[] = [];
  for (const [key, f] of Object.entries(fields)) {
    if (f.status === "not_established") {
      if (OFF_SOURCE.test(f.note_en) && !/not (established|stated|described|given)/i.test(f.note_en)) problems.push({ field: key, message: "a note may mention hadith only to say it is not used here" });
      continue;
    }
    for (const r of f.refs) {
      if (r.to < r.from) problems.push({ field: key, message: `reference ${r.surah}:${r.from}-${r.to} runs backwards` });
      for (const a of [r.from, r.to]) if (!hasAyah(r.surah, a)) problems.push({ field: key, message: `${r.surah}:${a} is not in the Quran text` });
    }
    const allowed = new Set(f.numbers ?? []);
    for (const n of f.text_en.match(/\d+/g) ?? []) if (!allowed.has(n)) problems.push({ field: key, message: `the number ${n} is not declared in "numbers" (each number must be stated in a cited verse)` });
    for (const n of allowed) if (!f.text_en.includes(n)) problems.push({ field: key, message: `declared number ${n} does not appear in the text` });
    if (INVENTED.test(f.text_en)) problems.push({ field: key, message: "the text contains an invented detail (place, date, appearance, dress, custom) the Quran does not state" });
    if (OVERCLAIM.test(f.text_en)) problems.push({ field: key, message: "the text claims proof, a guarantee or a certain outcome" });
    if (OFF_SOURCE.test(f.text_en)) problems.push({ field: key, message: "this draft uses the Quran only: no hadith, narration, later tradition or other scripture" });
    const interpretive = interpretiveKeys.includes(key);
    if (interpretive && !f.text_en.startsWith(INTERPRETATION_PREFIX)) problems.push({ field: key, message: `a ${key} entry must start with "${INTERPRETATION_PREFIX}"` });
    if (!interpretive && f.text_en.startsWith(INTERPRETATION_PREFIX)) problems.push({ field: key, message: "only the interpretive fields may carry the interpretation label" });
  }
  return problems;
}

export type SourcedResult<T> = { ok: true; draft: T; problems: [] } | { ok: false; problems: SourcedProblem[] };

export const keysObject = (keys: readonly string[]) => z.object(Object.fromEntries(keys.map((k) => [k, SourcedField])) as Record<string, typeof SourcedField>).strict();
