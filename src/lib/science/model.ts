/**
 * Quran & Science: the vocabulary. Three assessments are kept SEPARATE and are never combined into a score:
 *   (1) scientific evidence state   (2) textual interpretation strength   (3) strength of the proposed connection
 * plus one relationship classification. Nothing in this module computes one from another, and there is no total.
 */
export const EVIDENCE_STATES = ["established", "well_supported", "emerging_evidence", "hypothesis", "speculative", "unsupported_or_contradicted", "outside_empirical_science"] as const;
export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export const INTERPRETATION_STRENGTHS = [
  "explicit_textual_description",
  "strongly_supported_linguistic_reading",
  "plausible_interpretive_connection",
  "disputed_interpretation",
  "weak_or_strained",
  "unsupported",
] as const;
export type InterpretationStrength = (typeof INTERPRETATION_STRENGTHS)[number];

/** A reviewer-set category. It is never computed from the other two assessments. */
export const CONNECTION_STRENGTHS = ["strong", "moderate", "limited", "tentative", "none_claimed"] as const;
export type ConnectionStrength = (typeof CONNECTION_STRENGTHS)[number];

export const RELATIONSHIPS = ["scientifically_established", "consistent_interpretation", "interpretation_debated", "active_research", "not_scientifically_testable", "unsupported_claim"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

/** 'unassessed' is what a field holds until a reviewer records a judgement. It is never shown as a rating. */
export type Assessed<T extends string> = T | "unassessed";

export const MILESTONE_KINDS = ["observation", "hypothesis", "experiment", "confirmation", "refinement", "consensus"] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];

export const DISCIPLINES = ["cosmology", "astronomy", "earth_science", "oceanography", "hydrology", "biology", "embryology", "geology", "physics", "metaphysics"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const TESTABILITY = ["unassessed", "testable", "partly_testable", "not_testable"] as const;
export type Testability = (typeof TESTABILITY)[number];

export const ERAS = ["classical", "contemporary"] as const;
export type Era = (typeof ERAS)[number];

export const REVIEW_STATUSES = ["not_reviewed", "under_review", "changes_requested", "approved", "rejected", "invalidated"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Metaphysical matters are never labelled with a scientific evidence state other than this one. */
export const OUTSIDE: EvidenceState = "outside_empirical_science";

export interface LinkDoc {
  surah: number;
  ayah: number;
  terms?: string[];
  relationship: Assessed<Relationship>;
  interpretation_strength: Assessed<InterpretationStrength>;
  connection_strength: Assessed<ConnectionStrength>;
  note?: string | null;
  interpretations?: InterpretationDoc[];
}
export interface InterpretationDoc {
  era: Era;
  evidence_status: "sourced" | "needs_source";
  scholar: string | null;
  work: string | null;
  locator: string | null;
  summary: string | null;
  proposed_after_discovery: boolean | null;
}
export interface MilestoneDoc {
  discovery: string;
  kind: MilestoneKind;
  label: string;
  year: number | null;
  verified_source: string | null;
  verified_note?: string | null;
}
export interface PublicationDoc {
  title: string;
  authors: string[];
  doi: string | null;
  year: number | null;
  url: string | null;
  verified_source: string | null;
}
export interface ClaimDoc {
  claim: string;
  kind: string;
  evidence_state: Assessed<EvidenceState>;
}
export interface QuestionDoc {
  question: string;
  known: string | null;
  uncertain: string | null;
  competing: string | null;
  testability: Testability;
  why_connection: string | null;
}
export type L3 = { en: string; ar: string; ur: string };

/** The card on the hub. */
export interface TopicListItem {
  slug: string;
  title: L3;
  discipline: Discipline;
  topic_kind: "natural" | "unseen";
  summary: string | null;
  scholarly_status: ReviewStatus;
  scientific_review: ReviewStatus;
  ai_generated: boolean;
  published: boolean;
  needs_rereview: boolean;
  updated_at?: string;
  links: Array<{ surah: number; ayah: number; relationship: Assessed<Relationship>; interpretation_strength: Assessed<InterpretationStrength>; connection_strength: Assessed<ConnectionStrength> }>;
  evidence_states: Array<Assessed<EvidenceState>>;
  milestones: MilestoneDoc[];
  /** Where the card came from: the database, or the repository's draft inventory (never reviewed). */
  origin?: "database" | "draft_file";
}

export interface TopicDoc extends Omit<TopicListItem, "links" | "evidence_states" | "milestones"> {
  phenomenon: string | null;
  limitations: string | null;
  alternatives: string | null;
  conclusion: string | null;
  does_not_establish: L3;
  claims: ClaimDoc[];
  links: LinkDoc[];
  milestones: MilestoneDoc[];
  publications: PublicationDoc[];
  evidence: Array<{ kind: string; summary: string; evidence_status: "sourced" | "needs_source"; cited: boolean }>;
  open_questions: QuestionDoc[];
  visuals: Array<{ kind: string; title: string; alt: string; credit: string | null; asset_ref: string | null; licence_status: string }>;
  localizations: Array<{ language: "ar" | "ur"; field: string; body: string; origin: string; translator_reviewed: boolean }>;
  reviews: { scientific: { decision: string; current_version: boolean; on: string } | null; scholarly: { decision: string; current_version: boolean; on: string } | null };
  version?: number;
  classification_version?: number;
}

export interface OpenQuestionItem extends QuestionDoc {
  topic: string;
  topic_title: L3;
  topic_kind: "natural" | "unseen";
  scholarly_status: ReviewStatus;
  scientific_review: ReviewStatus;
  published: boolean;
}

export interface TimelineTopic {
  slug: string;
  title: L3;
  topic_kind: "natural" | "unseen";
  scholarly_status: ReviewStatus;
  scientific_review: ReviewStatus;
  published: boolean;
  layer_a: Array<{ surah: number; ayah: number; era: Era | null; scholar: string | null; work: string | null; proposed_after_discovery: boolean | null }>;
  layer_b: MilestoneDoc[];
}

export function pick3(v: L3, locale: string): string {
  return locale === "ar" ? v.ar : locale === "ur" ? v.ur : v.en;
}
export const isRated = <T extends string>(v: Assessed<T> | undefined): v is T => !!v && v !== "unassessed";
