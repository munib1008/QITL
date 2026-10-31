import { z } from "zod";
import { STORY_KINDS } from "./model";

/**
 * The admin editor's input → one database row for the hadith stories module. Pure, so it is unit-tested. Every story starts
 * as a draft; the database re-checks everything (narrations, gradings, claims, no copying of the narration, the version-bound
 * scholarly review) when it is published. There is no field for narration text: a story points at hadith_entries rows.
 */
const slug = z.string().trim().regex(/^[a-z0-9-]{2,80}$/, "lower-case letters, digits and hyphens");
const uuid = z.string().uuid();
const optText = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length >= min ? v : null));
const title = (min = 2) => z.string().trim().min(min).max(200);
const position = z.number().int().min(1).max(50).default(1);

export const RECORD_TYPES = {
  hadith_story: "hadith_stories",
  hadith_story_entry: "hadith_story_entries",
  hadith_story_link: "hadith_story_links",
  hadith_story_claim: "hadith_story_claims",
  hadith_story_lesson: "hadith_story_lessons",
} as const;
export type RecordType = keyof typeof RECORD_TYPES;
export const RECORD_TYPE_KEYS = Object.keys(RECORD_TYPES) as RecordType[];

export const SCHEMAS = {
  hadith_story: z.object({
    slug,
    kind: z.enum(STORY_KINDS),
    title_en: title(),
    title_ar: optText(200, 2),
    title_ur: optText(200, 2),
    narrator_en: optText(200, 2),
    narrator_ar: optText(200, 2),
    narrator_ur: optText(200, 2),
    summary_en: optText(1500),
    summary_ar: optText(1500),
    summary_ur: optText(1500),
    // Empty = "Not established": the page says so and supplies no setting.
    context_en: optText(3000),
    context_ar: optText(3000),
    context_ur: optText(3000),
  }),
  hadith_story_entry: z.object({
    story_id: uuid,
    hadith_id: uuid,
    grading_id: z
      .union([uuid, z.literal("").transform(() => undefined)])
      .optional()
      .transform((v) => v ?? null),
    is_primary: z.boolean().default(false),
    variant_note: optText(300),
    position,
  }),
  hadith_story_link: z
    .object({
      story_id: uuid,
      target_kind: z.enum(["person", "community", "event", "theme"]),
      target_id: uuid,
      position,
    })
    .transform(({ target_kind, target_id, ...rest }) => ({
      ...rest,
      target_kind,
      person_id: target_kind === "person" ? target_id : null,
      community_id: target_kind === "community" ? target_id : null,
      event_id: target_kind === "event" ? target_id : null,
      guidance_topic_id: target_kind === "theme" ? target_id : null,
    })),
  hadith_story_claim: z.object({ story_id: uuid, claim_id: uuid, position }),
  hadith_story_lesson: z.object({
    story_id: uuid,
    kind: z.enum(["lesson", "modern_application"]),
    body_en: z.string().trim().min(10).max(1500),
    body_ar: optText(1500),
    body_ur: optText(1500),
    position,
  }),
} satisfies Record<RecordType, z.ZodTypeAny>;

export type BuildResult = { ok: true; table: string; row: Record<string, unknown> } | { ok: false; issues: string[] };

/** Validate an editor's input for a record type and shape the draft row. */
export function buildRow(type: RecordType, input: unknown): BuildResult {
  const parsed = SCHEMAS[type].safeParse(input);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".") || type}: ${i.message}`) };
  const row: Record<string, unknown> = { ...(parsed.data as Record<string, unknown>) };
  if (type === "hadith_story") row.status = "draft";
  return { ok: true, table: RECORD_TYPES[type], row };
}

/** What a story still lacks before the database will let it be published (a mirror of guard_hadith_story_publish, for the queue). */
export interface PublishFacts {
  narrator: boolean;
  summary: boolean;
  kind: string;
  narrations: Array<{ primary: boolean; collection: string; hasGrading: boolean; grade: string | null }>;
  quranClaims: number;
}

export function publishBlockers(f: PublishFacts): string[] {
  const out: string[] = [];
  if (!f.narrator) out.push("name the narrator");
  if (!f.summary) out.push("write the English summary");
  if (!f.narrations.length) out.push("add the narration the story points at");
  else if (f.narrations.filter((n) => n.primary).length !== 1) out.push("mark exactly one narration as the primary one");
  for (const n of f.narrations) {
    if (n.collection === "tirmidhi" || n.collection === "ibnmajah") {
      if (!n.hasGrading || (n.grade !== "sahih" && n.grade !== "sahih li-ghayrihi")) out.push(`${n.collection} needs an individual grading of sahih or sahih li-ghayrihi by a named grader`);
    } else if (n.collection !== "bukhari" && n.collection !== "muslim") out.push(`${n.collection} is not an allowed source`);
  }
  if (f.kind === "clarifies_quranic_story" && f.quranClaims === 0) out.push("add a Quran connection (an approved claim with Quran references)");
  return [...new Set(out)];
}
