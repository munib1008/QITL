/**
 * Life Through the Ages: the evidence model shared by the pages, the editor and the tests.
 * Pure (no I/O). The database enforces the same rules (supabase/migrations/20261031002060_life_through_ages.sql);
 * this module mirrors them so the UI can explain what is missing before the database refuses it.
 *
 * Nothing here is research content: only categories, field names and rules.
 */

export type EvidenceCategory = "A" | "B" | "C" | "D";
export const CATEGORIES: EvidenceCategory[] = ["A", "B", "C", "D"];
export type Pathway = "religious" | "scientific";
export type Confidence = "high" | "moderate" | "low" | "speculative";

/** The 20-field "How They Lived" template, in display order. */
export const FIELD_KEYS = [
  "period",
  "region",
  "community",
  "lifespan",
  "daily_activities",
  "occupation",
  "foods_beverages",
  "farming_livestock",
  "clothing_care",
  "housing",
  "transport",
  "family_community",
  "customs_leisure",
  "education",
  "health_treatment",
  "climate",
  "worship",
  "challenges",
  "differences_modern",
  "lessons",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

/** The evidence block every research row carries. */
export interface EvidenceBlock {
  evidence_category: EvidenceCategory | null;
  claim_id?: string | null;
  primary_citation?: string | null;
  publication?: string | null;
  dating_method?: string | null;
  geographic_relevance?: string | null;
  confidence?: Confidence | null;
  language?: string | null;
  last_reviewed_at?: string | null;
  limitations?: string | null;
  is_reconstruction?: boolean | null;
}

export function pathwayFor(c: EvidenceCategory | null): Pathway {
  return c === "C" || c === "D" ? "scientific" : "religious";
}

/** Which reviews a record needs: A/B (and "not established") → religious; C/D → scientific; mixed → both. */
export function requiredPathways(categories: Array<EvidenceCategory | null>): Pathway[] {
  const out = new Set<Pathway>();
  for (const c of categories) out.add(pathwayFor(c));
  if (!out.size) out.add("religious");
  return (["religious", "scientific"] as Pathway[]).filter((p) => out.has(p));
}

/** What still blocks publication of a row, in plain words (mirrors guard_lifestyle_publish). */
export function publishProblems(r: EvidenceBlock & { claimApproved?: boolean }): string[] {
  const p: string[] = [];
  const c = r.evidence_category;
  if (!c) return p;
  if (!r.confidence) p.push("State the confidence level.");
  if ((c === "A" || c === "B") && (!r.claim_id || !r.claimApproved)) p.push(`Class ${c} needs a link to an approved evidence claim.`);
  if (c === "C" && (!r.publication || !r.primary_citation)) p.push("Class C needs a named publication and its citation.");
  if (c === "D" && !r.is_reconstruction) p.push("Class D is published only with the reconstruction flag.");
  if (c !== "D" && r.is_reconstruction) p.push("Only class D carries the reconstruction flag.");
  return p;
}

/** D rows are never shown as fact: they always go to the separate reconstruction container. */
export function splitReconstructions<T extends { evidence_category: EvidenceCategory | null }>(rows: T[]): { established: T[]; reconstructions: T[] } {
  return { established: rows.filter((r) => r.evidence_category !== "D"), reconstructions: rows.filter((r) => r.evidence_category === "D") };
}

/** Lessons: religious teaching (A/B) is kept apart from modern medical or nutritional research (C). */
export function splitLessons<T extends { evidence_category: EvidenceCategory | null }>(rows: T[]): { religious: T[]; modern: T[]; reconstructions: T[] } {
  return {
    religious: rows.filter((r) => r.evidence_category === "A" || r.evidence_category === "B"),
    modern: rows.filter((r) => r.evidence_category === "C"),
    reconstructions: rows.filter((r) => r.evidence_category === "D"),
  };
}

/* ---------- Lifespan evidence lanes ---------- */

export const LIFESPAN_KINDS = ["quran_statement", "hadith_statement", "documented", "archaeological_estimate", "modern_life_expectancy", "modern_verified_max", "speculative_theory"] as const;
export type LifespanKind = (typeof LIFESPAN_KINDS)[number];
export const LIFESPAN_MEASURES = ["years_among_people", "total_age", "life_expectancy_at_birth", "after_childhood", "maximum"] as const;
export type LifespanMeasure = (typeof LIFESPAN_MEASURES)[number];

export interface LifespanRecord extends EvidenceBlock {
  id: string;
  kind: LifespanKind;
  measure: LifespanMeasure | null;
  statement: string;
  population?: string | null;
  value_years: number | null;
  value_low: number | null;
  value_high: number | null;
  value_note?: string | null;
}

export interface Lane {
  key: string;
  kind: LifespanKind;
  measure: LifespanMeasure | null;
  records: LifespanRecord[];
  /** The lane's own axis maximum: lanes never share a scale, so marks in different lanes cannot read as one trend. */
  max: number;
}

/**
 * One lane per evidence kind and measure. A record only ever appears in its own lane; lanes keep their own scale.
 * The renderer draws separate marks (points or ranges) and never a line joining records.
 */
export function buildLanes(records: LifespanRecord[]): Lane[] {
  const lanes = new Map<string, Lane>();
  for (const r of records) {
    const key = `${r.kind}:${r.measure ?? "none"}`;
    const lane = lanes.get(key) ?? { key, kind: r.kind, measure: r.measure, records: [], max: 0 };
    lane.records.push(r);
    lane.max = Math.max(lane.max, r.value_high ?? 0, r.value_years ?? 0, r.value_low ?? 0);
    lanes.set(key, lane);
  }
  const kindIdx = (k: LifespanKind) => LIFESPAN_KINDS.indexOf(k);
  const measureIdx = (m: LifespanMeasure | null) => (m ? LIFESPAN_MEASURES.indexOf(m) : -1);
  return [...lanes.values()].sort((a, b) => kindIdx(a.kind) - kindIdx(b.kind) || measureIdx(a.measure) - measureIdx(b.measure));
}

/* ---------- Timeline layers ---------- */

export const LAYERS = ["prophets", "lifestyle", "food", "housing", "trade", "transport", "health", "lifespan"] as const;
export type Layer = (typeof LAYERS)[number];
export function isLayer(v: string | undefined): v is Layer {
  return !!v && (LAYERS as readonly string[]).includes(v);
}

/** Record types an editor can create, with their tables and review entity types. */
export const RECORD_TYPES = {
  lifestyle_era: "historical_eras",
  lifestyle_community: "historical_communities",
  lifestyle_profile: "prophet_lifestyle_profiles",
  lifestyle_field: "prophet_lifestyle_fields",
  lifestyle_food: "historical_foods",
  lifestyle_food_link: "food_evidence_links",
  lifestyle_occupation: "historical_occupations",
  lifestyle_housing: "historical_housing",
  lifestyle_transport: "historical_transport",
  lifestyle_activity: "historical_daily_activities",
  lifestyle_health: "historical_health_conditions",
  lifestyle_lifespan: "historical_lifespan_claims",
  lifestyle_demographic: "demographic_research",
  lifestyle_reconstruction: "historical_reconstructions",
  lifestyle_infographic: "lifestyle_infographics",
  lifestyle_source: "lifestyle_source_references",
} as const;
export type RecordType = keyof typeof RECORD_TYPES;
export const RECORD_TYPE_KEYS = Object.keys(RECORD_TYPES) as RecordType[];

/** Prophet stop ids → the profile slugs shown on that stop (Musa's stop covers Musa and Harun). */
export function profileSlugsFor(stopId: string): string[] {
  return stopId === "musa" ? ["musa", "harun"] : [stopId];
}

/** Parts of the day for the "A Day in This Era" viewer: never hours. */
export const DAY_PARTS = ["before_dawn", "dawn", "morning", "midday", "afternoon", "sunset", "evening", "night"] as const;
export type DayPart = (typeof DAY_PARTS)[number];
const CLOCK = /(\d{1,2}\s*[:.]\s*\d{2})|(\d{1,2}\s*(am|pm|a\.m\.|p\.m\.))|o'clock|\bhours?\b/i;
/** Mirrors lifestyle_segments_ok: a segment names a part of the day and contains no clock time. */
export function segmentOk(s: { part: string; text: string }): boolean {
  return (DAY_PARTS as readonly string[]).includes(s.part) && typeof s.text === "string" && !CLOCK.test(s.text);
}
