import { z } from "zod";
import { FIELD_KEYS, type FieldKey } from "@/lib/lifestyle/model";

/**
 * "How They Lived" drafts (content/lifestyle/<slug>.draft.json): the 20-field profile of a prophet, written from the Quran
 * ONLY, as an AI draft pending review. Every field is either STATED with at least one Quran reference that supports it, or
 * NOT ESTABLISHED with a short note. Nothing is padded: the Quran says little about daily life, and an honest
 * "not established" is the correct entry for most fields. Dates, ages, places and customs are never inferred.
 */
export const LIFESTYLE_DRAFT_SCHEMA = "qitl.lifestyle.draft.v1";
export const INTERPRETATION_PREFIX = "Educational interpretation (not scripture):";
/** Fields whose text is a lesson or a comparison drawn by the writer, not something the Quran states; they must say so. */
export const INTERPRETIVE_FIELDS: FieldKey[] = ["differences_modern", "lessons"];

const Ref = z.object({ surah: z.number().int().min(1).max(114), from: z.number().int().min(1), to: z.number().int().min(1) });
export type LifestyleRef = z.infer<typeof Ref>;

const Field = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("stated"),
    text_en: z.string().min(20).max(420),
    refs: z.array(Ref).min(1),
    /** Digits that may appear in text_en, each one stated in a cited verse (e.g. 950 in 29:14). */
    numbers: z.array(z.string().regex(/^\d+$/)).optional(),
  }),
  z.object({ status: z.literal("not_established"), note_en: z.string().min(10).max(220) }),
]);
export type LifestyleField = z.infer<typeof Field>;

export const LifestyleDraft = z.object({
  schema: z.literal(LIFESTYLE_DRAFT_SCHEMA),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  fields: z.object(Object.fromEntries(FIELD_KEYS.map((k) => [k, Field])) as Record<FieldKey, typeof Field>).strict(),
});
export type LifestyleDraft = z.infer<typeof LifestyleDraft>;

/** Words that turn a Quranic statement into an invented detail of daily life. A reviewer can lift one with a source; a draft cannot. */
const INVENTED = /\b(wore|ate|lived in a|tent of|robe|sandals|village of|city of|born in|died in|year \d{3,4}|bc|bce|ad\b|ce\b)\b/i;
const UNHEDGED_PREDICTION = /\bscience (will|has proven)|proved? that|guarantee/i;

export interface LifestyleProblem {
  field?: string;
  message: string;
}

/** Validate a draft. `hasAyah(surah, ayah)` says whether the verse exists in the loaded Quran text. */
export function validateLifestyleDraft(input: unknown, hasAyah: (surah: number, ayah: number) => boolean): { ok: true; draft: LifestyleDraft; problems: [] } | { ok: false; problems: LifestyleProblem[] } {
  const parsed = LifestyleDraft.safeParse(input);
  if (!parsed.success) return { ok: false, problems: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) };
  const d = parsed.data;
  const problems: LifestyleProblem[] = [];
  for (const key of FIELD_KEYS) {
    const f = d.fields[key];
    if (f.status === "not_established") continue;
    for (const r of f.refs) {
      if (r.to < r.from) problems.push({ field: key, message: `reference ${r.surah}:${r.from}-${r.to} runs backwards` });
      for (const a of [r.from, r.to]) if (!hasAyah(r.surah, a)) problems.push({ field: key, message: `${r.surah}:${a} is not in the Quran text` });
    }
    const allowed = new Set(f.numbers ?? []);
    for (const n of f.text_en.match(/\d+/g) ?? []) if (!allowed.has(n)) problems.push({ field: key, message: `the number ${n} is not declared in "numbers" (each number must be stated in a cited verse)` });
    for (const n of allowed) if (!f.text_en.includes(n)) problems.push({ field: key, message: `declared number ${n} does not appear in the text` });
    if (INVENTED.test(f.text_en)) problems.push({ field: key, message: "the text contains an invented detail of daily life, a place, a date or a custom the Quran does not state" });
    if (UNHEDGED_PREDICTION.test(f.text_en)) problems.push({ field: key, message: "the text claims proof or a guarantee" });
    if ((INTERPRETIVE_FIELDS as string[]).includes(key) && !f.text_en.startsWith(INTERPRETATION_PREFIX)) problems.push({ field: key, message: `a ${key} entry must start with "${INTERPRETATION_PREFIX}"` });
    if (!(INTERPRETIVE_FIELDS as string[]).includes(key) && f.text_en.startsWith(INTERPRETATION_PREFIX)) problems.push({ field: key, message: "only the interpretive fields may carry the interpretation label" });
  }
  return problems.length ? { ok: false, problems } : { ok: true, draft: d, problems: [] };
}
