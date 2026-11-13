import type { Era, MilestoneKind } from "./model";

/**
 * The content validator for Quran & Science. It REJECTS (does not warn about):
 *   discovery_date_no_source     a discovery year, DOI or publication year with no verified source URL
 *   citation_no_locator          a citation with neither a DOI nor a URL
 *   invalid_doi                  a DOI that is not of the form 10.xxxx/...
 *   unseen_proved                a claim that science "proved" the unseen, angels, jinn, Allah or the resurrection
 *   proof_language               "proof score", "scientific miracle proven"
 *   future_confirmation          a prediction that future science "will confirm" the Quran or a verse
 *   awaiting_lab_proof           a metaphysical matter described as awaiting laboratory / empirical proof
 *   classical_modern_attribution a modern reading attributed to a classical scholar without a source (or "proposed after a discovery")
 *   medical_cure                 "cures all", "guaranteed healing"
 *   percent_confidence           a fixed-percentage "confidence" or certainty
 *   verified_without_reviews     a "verified" label without BOTH separate reviews (by two different people) on the current version
 *   missing_does_not_establish   the "What This Evidence Does Not Establish" section is absent
 * It is a tripwire for drafting mistakes, not a judge of the science or of the interpretation; passing it proves nothing about
 * correctness. The database repeats the text families in SQL (science_text_ok), compared on shared samples in tests/db/science.test.ts.
 */
export type ScienceViolation =
  | "discovery_date_no_source"
  | "citation_no_locator"
  | "invalid_doi"
  | "unseen_proved"
  | "proof_language"
  | "future_confirmation"
  | "awaiting_lab_proof"
  | "classical_modern_attribution"
  | "medical_cure"
  | "percent_confidence"
  | "verified_without_reviews"
  | "missing_does_not_establish";

const TEXT_RULES: Array<{ code: ScienceViolation; re: RegExp }> = [
  { code: "proof_language", re: /\bproof\s+score\b/i },
  { code: "proof_language", re: /scientific\s+miracles?\s+(?:is\s+|are\s+)?(?:proven|proved|confirmed)/i },
  { code: "unseen_proved", re: /\b(?:science|scientists|research|modern science)\s+(?:has\s+|have\s+)?(?:proved|proven|confirmed)\b[^.]{0,60}\b(?:angels?|jinn|the unseen|resurrection|allah|god)\b/i },
  { code: "unseen_proved", re: /\b(?:proves?|proved|proven)\b[^.]{0,40}\b(?:the existence of|that)\b[^.]{0,30}\b(?:angels?|jinn|the unseen|resurrection)\b/i },
  { code: "future_confirmation", re: /\b(?:future|later|coming|upcoming|further)\s+(?:science|research|discoveries|studies|findings)\s+(?:will|shall)\s+(?:confirm|prove|verify|show)/i },
  { code: "future_confirmation", re: /\b(?:will|shall)\s+(?:one day\s+|eventually\s+|surely\s+)?(?:prove|confirm|verify)\s+(?:the\s+)?(?:quran|verse|this)\b/i },
  { code: "awaiting_lab_proof", re: /\b(?:awaiting|awaits?|pending|until)\s+(?:laboratory|scientific|empirical)\s+(?:proof|confirmation|verification)/i },
  { code: "medical_cure", re: /\bcures?\s+(?:all|every|any)\b/i },
  { code: "medical_cure", re: /\bguarantee[sd]?\s+(?:healing|cure|recovery)/i },
  { code: "percent_confidence", re: /\b\d{1,3}\s*%\s*(?:confiden|certain|certainty|sure|proven|accurate|match)/i },
  { code: "percent_confidence", re: /\bconfidence\s+(?:score|level|rating)?\s*(?:of|:|=)?\s*\d/i },
  { code: "proof_language", re: /معجزة علمية (?:مثبتة|ثابتة)|ثبت علميا أن/ },
  { code: "proof_language", re: /سائنسی معجزہ ثابت|سائنس نے ثابت کر دیا/ },
];

/** The violations found in one piece of free text (EN / AR / UR). Sorted, no duplicates. */
export function checkScienceText(text: string): ScienceViolation[] {
  const found = new Set<ScienceViolation>();
  for (const r of TEXT_RULES) if (r.re.test(text)) found.add(r.code);
  return [...found].sort();
}

const DOI = /^10\.\d{4,9}\/\S+$/;
const URL_RE = /^https?:\/\/\S+$/;

export interface MilestoneInput {
  kind?: MilestoneKind;
  label: string;
  year?: number | null;
  verifiedSource?: string | null;
}
export interface PublicationInput {
  title: string;
  doi?: string | null;
  url?: string | null;
  year?: number | null;
  verifiedSource?: string | null;
}
export interface InterpretationInput {
  era: Era;
  scholar?: string | null;
  summary?: string | null;
  sourceRecorded?: boolean;
  proposedAfterDiscovery?: boolean | null;
}
export interface ReviewFacts {
  scientificApproved: boolean;
  scholarlyApproved: boolean;
  scientificReviewer?: string | null;
  scholarlyReviewer?: string | null;
  /** both reviews are for the version being shown */
  currentVersion: boolean;
}
export interface TopicInput {
  kind?: "natural" | "unseen";
  texts?: Record<string, string | null | undefined>;
  doesNotEstablish?: { en?: string | null; ar?: string | null; ur?: string | null };
  milestones?: MilestoneInput[];
  publications?: PublicationInput[];
  interpretations?: InterpretationInput[];
  /** the label the page is about to show */
  label?: "verified" | "draft";
  reviews?: ReviewFacts;
}
export interface Finding {
  code: ScienceViolation;
  where: string;
}

export function validateMilestone(m: MilestoneInput): ScienceViolation[] {
  return m.year != null && !(m.verifiedSource && URL_RE.test(m.verifiedSource)) ? ["discovery_date_no_source"] : [];
}
export function validatePublication(p: PublicationInput): ScienceViolation[] {
  const out: ScienceViolation[] = [];
  if (!p.doi && !p.url) out.push("citation_no_locator");
  if (p.doi && !DOI.test(p.doi)) out.push("invalid_doi");
  if (p.url && !URL_RE.test(p.url)) out.push("citation_no_locator");
  if ((p.doi || p.year != null) && !(p.verifiedSource && URL_RE.test(p.verifiedSource))) out.push("discovery_date_no_source");
  return out;
}
export function validateInterpretation(i: InterpretationInput): ScienceViolation[] {
  if (i.era !== "classical") return [];
  if (i.proposedAfterDiscovery === true) return ["classical_modern_attribution"];
  if (!i.sourceRecorded && i.summary) return ["classical_modern_attribution"];
  return [];
}
export function validateReviews(label: "verified" | "draft" | undefined, r: ReviewFacts | undefined): ScienceViolation[] {
  if (label !== "verified") return [];
  const ok = !!r && r.scientificApproved && r.scholarlyApproved && r.currentVersion && !!r.scientificReviewer && !!r.scholarlyReviewer && r.scientificReviewer !== r.scholarlyReviewer;
  return ok ? [] : ["verified_without_reviews"];
}

/** Everything the validator rejects in a topic, with where it was found. An empty list is the only passing result. */
export function validateTopic(t: TopicInput): Finding[] {
  const f: Finding[] = [];
  for (const [k, v] of Object.entries(t.texts ?? {})) {
    if (!v) continue;
    for (const code of checkScienceText(v)) f.push({ code, where: k });
    // A metaphysical matter is never described as awaiting a laboratory result, whatever the exact wording.
    if (t.kind === "unseen" && /\b(?:laboratory|lab)\s+(?:proof|confirmation|verification)\b/i.test(v)) f.push({ code: "awaiting_lab_proof", where: k });
  }
  t.milestones?.forEach((m, i) => validateMilestone(m).forEach((code) => f.push({ code, where: `milestones[${i}]` })));
  t.publications?.forEach((p, i) => validatePublication(p).forEach((code) => f.push({ code, where: `publications[${i}]` })));
  t.interpretations?.forEach((x, i) => validateInterpretation(x).forEach((code) => f.push({ code, where: `interpretations[${i}]` })));
  validateReviews(t.label, t.reviews).forEach((code) => f.push({ code, where: "label" }));
  const d = t.doesNotEstablish;
  if (d && !(d.en && d.en.trim().length >= 20 && d.ar?.trim() && d.ur?.trim())) f.push({ code: "missing_does_not_establish", where: "doesNotEstablish" });
  return f;
}

/** Throws a readable error when a topic breaks any rule (used by the seed loader and the admin API). */
export function assertTopic(t: TopicInput): void {
  const f = validateTopic(t);
  if (f.length) throw new Error(`Refused by the Quran & Science validator: ${f.map((x) => `${x.where}: ${x.code}`).join("; ")}`);
}

/**
 * Which sections a topic page still lacks. 'does_not_establish' is mandatory on every page; the others are reported so the
 * page can show an honest "awaiting" placeholder instead of filler.
 */
export function topicCompleteness(t: {
  doesNotEstablish?: { en?: string | null; ar?: string | null; ur?: string | null };
  links?: unknown[];
  phenomenon?: string | null;
  limitations?: string | null;
  alternatives?: string | null;
  conclusion?: string | null;
}): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  const d = t.doesNotEstablish;
  if (!(d && d.en && d.en.trim().length >= 20 && d.ar?.trim() && d.ur?.trim())) missing.push("does_not_establish");
  if (!t.links?.length) missing.push("quran_passage");
  if (!t.phenomenon) missing.push("phenomenon");
  if (!t.limitations) missing.push("limitations");
  if (!t.alternatives) missing.push("alternatives");
  if (!t.conclusion) missing.push("conclusion");
  return { complete: missing.length === 0, missing };
}
