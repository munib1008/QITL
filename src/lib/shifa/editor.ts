import { z } from "zod";
import { ENTRY_KINDS, ICON_KEYS, SAFETY_KINDS, STUDY_TYPES, type EntryKind, type EvidenceCategory, type Pathway, type ShifaSection } from "./model";

/**
 * The admin editor's input → one database row. Pure, so it is unit-tested. Every row starts as a draft; the database
 * re-checks everything (claims, citations, flags, safety notes, both reviews) when it is published.
 *
 * There is no field for a dosage, an instruction or personal advice, and the text lint below refuses the same patterns
 * the database refuses (supabase/migrations/20261031002400_shifa.sql: shifa_no_dosage, shifa_no_instruction), so an
 * editor sees the problem before the database says no.
 */

/** Amounts with units and per-day frequencies: no dosage in this module. */
const DOSAGE = [
  /(^|[^\p{L}\p{N}])[0-9٠-٩۰-۹]+([.,][0-9٠-٩۰-۹]+)?\s*(mg|mcg|µg|gm|g|kg|ml|cc|iu|tsp|tbsp|teaspoons?|tablespoons?|spoonfuls?|capsules?|tablets?|pills?|drops?|grams?|milligrams?|litres?|liters?|cups?|glass(es)?|dates|seeds|pieces)([^\p{L}]|$)/iu,
  /(once|twice|thrice|times)\s+(a|per|each|every)\s+(day|night|week|morning|evening|hour|meal)/i,
  /(daily|nightly|weekly)\s+(dose|amount|intake)|recommended\s+(dose|amount)/i,
];
/** Imperative treatment instructions and promised cures. */
const INSTRUCTION = [
  /(^|[.!?;:])\s*(take|drink|eat|apply|mix|swallow|rub|inhale|consume|boil|dissolve|sip|chew)\s/i,
  /(you|we|patients|readers|everyone|one)\s+(should|must|can|could|may|need to|ought to)\s+(take|drink|eat|apply|consume|mix|swallow)/i,
  /(guarantee[ds]?|miracle cure|cure-all|will cure|always cures|certain cure|sure cure)/i,
];

export type TextProblem = "dosage" | "instruction";

/** What is wrong with a free-text field, if anything. `dosageOnly` is for safety notes, which may speak in the imperative. */
export function textProblems(text: string | null | undefined, opts: { dosageOnly?: boolean } = {}): TextProblem[] {
  if (!text) return [];
  const out: TextProblem[] = [];
  if (DOSAGE.some((r) => r.test(text))) out.push("dosage");
  if (!opts.dosageOnly && INSTRUCTION.some((r) => r.test(text))) out.push("instruction");
  return out;
}

const MESSAGE: Record<TextProblem, string> = {
  dosage: "contains an amount with a unit or a per-day frequency; Shifa gives no dosage",
  instruction: "reads as a treatment instruction or a promised cure; Shifa gives none",
};
const clean = (max: number, opts: { dosageOnly?: boolean; min?: number } = {}) =>
  z
    .string()
    .trim()
    .min(opts.min ?? 0)
    .max(max)
    .superRefine((v, ctx) => {
      for (const p of textProblems(v, opts)) ctx.addIssue({ code: "custom", message: MESSAGE[p] });
    });
const opt = (max: number, opts: { dosageOnly?: boolean } = {}) =>
  clean(max, opts)
    .optional()
    .transform((v) => (v ? v : null));
const slug = z.string().trim().regex(/^[a-z0-9-]{2,60}$/, "lower-case letters, digits and hyphens");
const uuid = z.string().uuid();
const optUuid = z.union([z.string().uuid(), z.literal("").transform(() => undefined)]).optional().transform((v) => v ?? null);
const position = z.number().int().min(1).max(500).default(1);

export const RECORD_TYPES = {
  shifa_topic: "shifa_topics",
  shifa_entry: "shifa_entries",
  shifa_layer: "shifa_layers",
  shifa_scholarly_note: "shifa_scholarly_notes",
  shifa_safety_note: "shifa_safety_notes",
  shifa_link: "shifa_links",
} as const;
export type RecordType = keyof typeof RECORD_TYPES;
export const RECORD_TYPE_KEYS = Object.keys(RECORD_TYPES) as RecordType[];
/** The types that carry a status and a review (layers and scholarly notes are parts of an entry and travel with it). */
export const REVIEWED_TYPES = ["shifa_topic", "shifa_entry", "shifa_safety_note", "shifa_link"] as const;
export type ReviewedType = (typeof REVIEWED_TYPES)[number];

const Layer = z
  .object({
    entry_id: uuid,
    evidence_category: z.enum(["A", "B", "C", "D"]),
    position,
    claim_id: optUuid,
    finding: opt(4000),
    publication: opt(500),
    citation: opt(1000),
    study_type: z.enum(STUDY_TYPES as [string, ...string[]]).optional().transform((v) => v ?? null),
    population: opt(500),
    limitations: opt(2000),
    url: z
      .string()
      .trim()
      .regex(/^https:\/\//)
      .optional()
      .or(z.literal("").transform(() => undefined))
      .transform((v) => v ?? null),
    states_health_effect: z.boolean().default(false),
    is_traditional: z.boolean().default(false),
    is_hypothesis: z.boolean().default(false),
    language: z.string().trim().regex(/^[a-z]{2,3}$/).default("en"),
  })
  .superRefine((v, ctx) => {
    if ((v.evidence_category === "A" || v.evidence_category === "B") && !v.claim_id) ctx.addIssue({ code: "custom", path: ["claim_id"], message: "pick the approved evidence claim this layer rests on" });
    if (v.evidence_category === "C") {
      for (const k of ["finding", "publication", "citation", "study_type", "population"] as const) if (!v[k]) ctx.addIssue({ code: "custom", path: [k], message: "required for research (class C)" });
      if ((v.limitations ?? "").length < 20) ctx.addIssue({ code: "custom", path: ["limitations"], message: "state the limits: study size, species or population, what was studied, conflicts (at least 20 characters)" });
    }
    if (v.evidence_category === "D") {
      if (!v.finding) ctx.addIssue({ code: "custom", path: ["finding"], message: "write the statement" });
      if (!v.is_traditional && !v.is_hypothesis) ctx.addIssue({ code: "custom", path: ["is_traditional"], message: "flag it as traditional use and/or hypothesis" });
    }
  });

export const SCHEMAS = {
  shifa_topic: z.object({
    slug,
    section: z.enum(["quranic_healing", "ruqyah", "prophetic_remedies", "wellbeing"]),
    title_en: clean(120, { min: 2 }),
    title_ar: opt(120),
    icon_key: z.enum(ICON_KEYS).default("leaf"),
    position: z.number().int().min(1).max(500).default(100),
  }),
  shifa_entry: z.object({
    topic_id: uuid,
    slug,
    kind: z.enum(ENTRY_KINDS as [EntryKind, ...EntryKind[]]),
    title_en: clean(160, { min: 2 }),
    title_ar: opt(160),
    position,
  }),
  shifa_layer: Layer,
  shifa_scholarly_note: z.object({
    entry_id: uuid,
    claim_id: uuid,
    scholar_name: z.string().trim().min(2).max(200),
    work_title: z.string().trim().min(2).max(300),
    source_id: optUuid,
    locator: opt(200),
    position,
  }),
  shifa_safety_note: z.object({
    topic_id: uuid,
    entry_id: optUuid,
    kind: z.enum(SAFETY_KINDS as [string, ...string[]]),
    body_en: clean(2000, { min: 10, dosageOnly: true }),
    body_ar: opt(2000, { dosageOnly: true }),
    position,
  }),
  shifa_link: z
    .object({
      topic_id: uuid,
      entry_id: optUuid,
      target_kind: z.enum(["person", "event", "story", "guidance_topic", "food"]),
      target_id: uuid,
      position,
    })
    .transform(({ target_kind, target_id, ...rest }) => ({
      ...rest,
      target_kind,
      person_id: target_kind === "person" ? target_id : null,
      event_id: target_kind === "event" ? target_id : null,
      story_id: target_kind === "story" ? target_id : null,
      guidance_topic_id: target_kind === "guidance_topic" ? target_id : null,
      food_id: target_kind === "food" ? target_id : null,
    })),
} satisfies Record<RecordType, z.ZodTypeAny>;

export type BuildResult = { ok: true; table: string; row: Record<string, unknown> } | { ok: false; issues: string[] };

/** Validate an editor's input for a record type and shape the draft row. */
export function buildRow(type: RecordType, input: unknown): BuildResult {
  const parsed = SCHEMAS[type].safeParse(input);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".") || type}: ${i.message}`) };
  const row: Record<string, unknown> = { ...(parsed.data as Record<string, unknown>) };
  if (type === "shifa_layer") {
    const cat = row.evidence_category as EvidenceCategory;
    // A and B hold their approved claim and nothing else: scripture is a record, never a health statement.
    if (cat === "A" || cat === "B") {
      for (const k of ["finding", "publication", "citation", "study_type", "population", "limitations", "url"]) row[k] = null;
      row.states_health_effect = false;
      row.is_traditional = false;
      row.is_hypothesis = false;
    }
    if (cat === "C") {
      row.claim_id = null;
      row.is_traditional = false;
      row.is_hypothesis = false;
    }
    if (cat === "D") {
      row.claim_id = null;
      row.states_health_effect = false;
      for (const k of ["publication", "study_type", "population"]) row[k] = null;
    }
  }
  if (type === "shifa_topic" || type === "shifa_entry" || type === "shifa_safety_note" || type === "shifa_link") row.status = "draft";
  return { ok: true, table: RECORD_TYPES[type], row };
}

/**
 * Which reviews a record needs: the UI mirror of shifa_required_pathways (the database computes the final answer).
 * Religious: A/B, scholarly notes, supplications, Quranic healing and ruqyah. Clinical: C/D, remedies and lifestyle items,
 * and anything in the remedies or wellbeing sections. Both when both apply.
 */
export function requiredPathways(r:
  | { type: "shifa_topic"; section: ShifaSection }
  | { type: "shifa_entry"; section: ShifaSection; kind: EntryKind; categories: EvidenceCategory[]; scholarlyNotes: number }
  | { type: "shifa_safety_note"; kind: string }
  | { type: "shifa_link" }): Pathway[] {
  if (r.type === "shifa_topic") return r.section === "prophetic_remedies" || r.section === "wellbeing" ? ["religious", "clinical"] : ["religious"];
  if (r.type === "shifa_safety_note") return r.kind === "ruling_referral" ? ["religious"] : ["clinical"];
  if (r.type === "shifa_link") return ["religious"];
  const out: Pathway[] = [];
  const cats = new Set(r.categories);
  if (cats.has("A") || cats.has("B") || r.kind === "supplication" || r.section === "quranic_healing" || r.section === "ruqyah" || r.scholarlyNotes > 0) out.push("religious");
  if (cats.has("C") || cats.has("D") || r.kind === "remedy" || r.kind === "lifestyle" || r.section === "prophetic_remedies" || r.section === "wellbeing") out.push("clinical");
  return out.length ? out : ["religious"];
}
