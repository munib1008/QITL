import { z } from "zod";
import { DAY_PARTS, FIELD_KEYS, LIFESPAN_KINDS, LIFESPAN_MEASURES, RECORD_TYPES, type RecordType } from "./model";

/**
 * The admin editor's input → one database row. Pure, so it is unit-tested. Every row starts as a draft; the database
 * re-checks everything (categories, claims, citations, the reconstruction flag, reviews) when it is published.
 */
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const slug = z.string().trim().regex(/^[a-z0-9-]{2,60}$/, "lower-case letters, digits and hyphens");
const uuid = z.string().uuid().optional().or(z.literal("").transform(() => undefined)).transform((v) => v ?? null);
const num = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v > 0), "a positive number");

export const Evidence = z.object({
  evidence_category: z.enum(["A", "B", "C", "D"]),
  claim_id: uuid,
  primary_citation: opt(1000),
  publication: opt(500),
  dating_method: opt(500),
  geographic_relevance: opt(500),
  confidence: z.enum(["high", "moderate", "low", "speculative"]).optional().transform((v) => v ?? null),
  language: z.string().trim().regex(/^[a-z]{2,3}$/).default("en"),
  limitations: opt(2000),
  is_reconstruction: z.boolean().default(false),
});

const Topic = Evidence.extend({
  slug,
  title_en: z.string().trim().min(2).max(160),
  title_ar: opt(160),
  body_md: z.string().max(20000).default(""),
  era_id: uuid,
  community_id: uuid,
  person_id: uuid,
  location_id: uuid,
  comparison_band: z.enum(["ancient", "documented", "contemporary"]).optional().transform((v) => v ?? null),
});

export const SCHEMAS = {
  lifestyle_era: Evidence.extend({ slug, name_en: z.string().trim().min(2).max(160), name_ar: opt(160), summary: opt(5000), relative_order: num }),
  lifestyle_community: Evidence.extend({ slug, name_en: z.string().trim().min(2).max(160), name_ar: opt(160), summary: opt(5000), era_id: uuid, location_id: uuid }),
  lifestyle_profile: z.object({ person_slug: slug }),
  lifestyle_field: Evidence.partial({ evidence_category: true }).extend({
    profile_id: z.string().uuid(),
    field_key: z.enum(FIELD_KEYS),
    position: z.number().int().min(1).max(50).default(1),
    known: z.boolean(),
    body_md: z.string().max(20000).default(""),
  }),
  lifestyle_food: Evidence.extend({
    slug,
    name_en: z.string().trim().min(2).max(160),
    name_ar: opt(160),
    food_group: z.enum(["grain", "fruit", "vegetable", "legume", "dairy", "meat", "fish", "honey", "oil", "beverage", "spice", "other"]).default("other"),
    summary: opt(5000),
  }),
  lifestyle_food_link: Evidence.extend({
    food_id: z.string().uuid(),
    link_kind: z.enum(["scripture_mention", "hadith_mention", "archaeological_find", "historical_record", "nutrition_research", "reconstruction"]),
    statement: z.string().max(5000).default(""),
    health_claim: z.boolean().default(false),
    person_id: uuid,
    community_id: uuid,
    era_id: uuid,
  }),
  lifestyle_occupation: Topic.extend({ domain: z.enum(["farming", "herding", "crafts", "trade", "building", "seafaring", "learning", "household", "other"]).default("other") }),
  lifestyle_housing: Topic,
  lifestyle_transport: Topic,
  lifestyle_activity: Topic,
  lifestyle_health: Topic,
  lifestyle_lifespan: Evidence.extend({
    kind: z.enum(LIFESPAN_KINDS),
    measure: z.enum(LIFESPAN_MEASURES).optional().transform((v) => v ?? null),
    statement: z.string().max(5000).default(""),
    person_id: uuid,
    community_id: uuid,
    era_id: uuid,
    population: opt(300),
    value_years: num,
    value_low: num,
    value_high: num,
    value_note: opt(2000),
  }),
  lifestyle_demographic: Evidence.extend({
    title: z.string().trim().min(3).max(200),
    population: opt(300),
    metric: z.enum(["population_size", "life_expectancy_at_birth", "life_expectancy_after_childhood", "mortality", "fertility", "stature", "other"]),
    value: num,
    value_low: num,
    value_high: num,
    unit: opt(60),
    method_note: opt(2000),
    era_id: uuid,
    location_id: uuid,
  }),
  lifestyle_reconstruction: Evidence.extend({
    slug,
    kind: z.enum(["day_in_era", "settlement", "diet", "scene", "other"]),
    title_en: z.string().trim().min(2).max(160),
    title_ar: opt(160),
    intro_md: z.string().max(20000).default(""),
    segments: z.array(z.object({ part: z.enum(DAY_PARTS), text: z.string().max(2000) })).default([]),
    limitations_md: z.string().max(5000).default(""),
    era_id: uuid,
    community_id: uuid,
    location_id: uuid,
  }),
  lifestyle_infographic: Evidence.extend({
    slug,
    kind: z.enum(["diagram", "map", "chart", "landscape", "objects", "pattern"]),
    animation_key: z.string().regex(/^[a-z0-9-]{2,60}$/),
    alt_text: z.string().trim().min(3).max(500),
    caption: z.string().max(500).default(""),
    era_id: uuid,
    community_id: uuid,
  }),
  lifestyle_source: z.object({
    entity_type: z.enum(Object.keys(RECORD_TYPES) as [RecordType, ...RecordType[]]),
    entity_id: z.string().uuid(),
    source_id: uuid,
    citation: z.string().trim().min(3).max(1000),
    publication: opt(500),
    edition: opt(200),
    locator: opt(200),
    url: z
      .string()
      .trim()
      .regex(/^https:\/\//)
      .optional()
      .or(z.literal("").transform(() => undefined))
      .transform((v) => v ?? null),
    language: z.string().trim().regex(/^[a-z]{2,3}$/).default("en"),
  }),
} satisfies Record<RecordType, z.ZodTypeAny>;

export type BuildResult = { ok: true; table: string; row: Record<string, unknown> } | { ok: false; issues: string[] };

/** Validate an editor's input for a record type and shape the draft row. A not-established field carries no evidence. */
export function buildRow(type: RecordType, input: unknown): BuildResult {
  const parsed = SCHEMAS[type].safeParse(input);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".") || type}: ${i.message}`) };
  const row: Record<string, unknown> = { ...(parsed.data as Record<string, unknown>), status: "draft" };
  if (type === "lifestyle_field" && row.known === false) {
    for (const k of Object.keys(Evidence.shape)) delete row[k];
    row.evidence_category = null;
    row.body_md = "";
  }
  if (row.evidence_category === "D") row.is_reconstruction = true;
  return { ok: true, table: RECORD_TYPES[type], row };
}
