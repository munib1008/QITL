import { z } from "zod";
import { checkSourcedFields, keysObject, type SourcedField, type SourcedProblem, type SourcedResult } from "./draft";

/** Creation Atlas profile drafts (content/creation/<slug>.draft.json). Categories match src/lib/data/creation-types.ts. */
export const CREATION_CATEGORIES = ["humans", "jinn", "iblis_shayatin", "angels", "animals", "heavens_earth"] as const;
export const CREATION_FIELDS = [
  "classification",
  "origin",
  "purpose",
  "nature",
  "abilities",
  "limitations",
  "relationship_with_humans",
  "quranic_events",
  "chronological_position",
  "location",
  "misconceptions",
  "lessons",
  "vocabulary",
] as const;
export const CREATION_INTERPRETIVE = ["misconceptions", "lessons"] as const;

export const CreationDraft = z.object({
  schema: z.literal("qitl.creation.draft.v1"),
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  category: z.enum(CREATION_CATEGORIES),
  name_en: z.string().min(2).max(80),
  name_ar: z.string().min(2).max(60),
  fields: keysObject(CREATION_FIELDS),
});
export type CreationDraft = z.infer<typeof CreationDraft>;

/** Life Guidance lesson drafts (content/guidance/<slug>.draft.json); the slug is one of the planned topics (src/lib/guidance/topics.ts). */
export const GUIDANCE_FIELDS = ["situation", "quran_says", "prophet_experience", "everyday_application", "limits"] as const;
export const GUIDANCE_INTERPRETIVE = ["situation", "everyday_application", "limits"] as const;
export const GuidanceDraft = z.object({
  schema: z.literal("qitl.guidance.draft.v1"),
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  fields: keysObject(GUIDANCE_FIELDS),
});
export type GuidanceDraft = z.infer<typeof GuidanceDraft>;

function run<T extends { fields: Record<string, SourcedField> }>(schema: z.ZodType<T>, input: unknown, hasAyah: (s: number, a: number) => boolean, interp: readonly string[]): SourcedResult<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, problems: parsed.error.issues.map((i): SourcedProblem => ({ field: i.path.join("."), message: i.message })) };
  const problems = checkSourcedFields(parsed.data.fields, hasAyah, interp);
  return problems.length ? { ok: false, problems } : { ok: true, draft: parsed.data, problems: [] };
}
export const validateCreationDraft = (input: unknown, hasAyah: (s: number, a: number) => boolean) => run(CreationDraft, input, hasAyah, CREATION_INTERPRETIVE);
export const validateGuidanceDraft = (input: unknown, hasAyah: (s: number, a: number) => boolean) => run(GuidanceDraft, input, hasAyah, GUIDANCE_INTERPRETIVE);
