import { z } from "zod";

/**
 * Pure logic of the People and Communities editor screen (/admin/people, /admin/communities): which encyclopedia kinds a person
 * may carry, which Event Universe track a record's subject item belongs to, what a claim's Quran references look like, the
 * request schemas shared by the screen and the API routes, and plain-language messages for the database's refusals.
 *
 * Everything here only mirrors rules that the database enforces (migration 20261031002521: people_prophet_label,
 * people_prophet_group, the track guards, "no evidence, no publish"). The mirror lets the screen explain a refusal before the
 * round trip; the database stays the real gate and is always asked.
 */

export const ENCYCLOPEDIA_KINDS = ["prophet", "individual", "family_member", "ruler", "unnamed"] as const;
export type EncyclopediaKind = (typeof ENCYCLOPEDIA_KINDS)[number];

export type Scope = "person" | "community";
export type SubjectTrack = "prophets" | "people" | "communities";

/** The Event Universe track that holds the item which IS this record (the database guard checks the same). */
export function trackFor(scope: Scope, personKind?: string | null): SubjectTrack {
  if (scope === "community") return "communities";
  return personKind === "prophet" ? "prophets" : "people";
}

/** Encyclopedia kinds an editor may choose for a person of this `kind`. A prophet is only ever filed as a prophet. */
export function allowedKinds(personKind: string): EncyclopediaKind[] {
  return personKind === "prophet" ? ["prophet"] : ENCYCLOPEDIA_KINDS.filter((k) => k !== "prophet");
}

export type KindIssue = "prophet_label" | "prophet_group";
/** Mirrors people_prophet_label and people_prophet_group. null = fine. */
export function kindIssue(personKind: string, encyclopediaKind: string | null | undefined): KindIssue | null {
  if (!encyclopediaKind) return null;
  if (encyclopediaKind === "prophet" && personKind !== "prophet") return "prophet_label";
  if (personKind === "prophet" && encyclopediaKind !== "prophet") return "prophet_group";
  return null;
}

const KIND_ISSUE_TEXT: Record<KindIssue, string> = {
  prophet_label: "Only a person whose kind is prophet can be labelled prophet. Choose another group, or change the person's kind first.",
  prophet_group: "A prophet is never filed under another group. Choose prophet, or leave the group empty.",
};
export const kindIssueText = (i: KindIssue) => KIND_ISSUE_TEXT[i];

// ---------- Request schemas (screen and routes share them) ----------
const uuid = z.string().uuid();

export const ClassificationSchema = z
  .object({
    scope: z.enum(["person", "community"]),
    id: uuid,
    // undefined = leave as it is; null = clear it.
    encyclopediaKind: z.enum(ENCYCLOPEDIA_KINDS).nullable().optional(),
    subjectEventId: uuid.nullable().optional(),
  })
  .refine((v) => v.encyclopediaKind !== undefined || v.subjectEventId !== undefined, { message: "Nothing to change." })
  .refine((v) => v.scope === "person" || v.encyclopediaKind === undefined, { message: "Only a person has an encyclopedia kind.", path: ["encyclopediaKind"] });
export type Classification = z.infer<typeof ClassificationSchema>;

export const AliasSchema = z.object({
  personId: uuid,
  alias: z.string().trim().min(1, "Write the alias.").max(120),
  language: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2,3}$/, "A language code such as en, ar or ur."),
});
export const AliasRemoveSchema = z.object({ personId: uuid, alias: z.string().min(1).max(120) });

export const PersonClaimSchema = z.object({ personId: uuid, claimId: uuid, position: z.number().int().min(1).max(50).optional() });
export const PersonClaimRemoveSchema = z.object({ id: uuid });

export const ListQuerySchema = z.object({
  view: z.enum(["list", "detail", "events", "claims"]),
  scope: z.enum(["person", "community"]).default("person"),
  q: z.string().trim().max(120).optional(),
  status: z.enum(["draft", "in_review", "approved", "published", "correction"]).optional(),
  id: uuid.optional(),
  track: z.enum(["prophets", "people", "communities"]).optional(),
});
export type ListQuery = z.infer<typeof ListQuerySchema>;

/** A search term for a PostgREST ilike filter: wildcards and filter-syntax characters are not user input. */
export function likeTerm(q: string | undefined): string | null {
  const t = (q ?? "").replace(/[%_\\,()*]/g, " ").replace(/\s+/g, " ").trim();
  return t ? t : null;
}

// ---------- Claims and their references ----------
export interface RefRow {
  kind: string;
  quran_surah: number | null;
  quran_ayah_from: number | null;
  quran_ayah_to: number | null;
}
/** "12:3", "12:3-5". Only Quran references are shown as verses; nothing is ever typed in here. */
export function quranRefs(refs: RefRow[] | null | undefined): string[] {
  return (refs ?? [])
    .filter((r) => r.kind === "quran" && r.quran_surah != null && r.quran_ayah_from != null)
    .map((r) => (r.quran_ayah_to != null && r.quran_ayah_to !== r.quran_ayah_from ? `${r.quran_surah}:${r.quran_ayah_from}-${r.quran_ayah_to}` : `${r.quran_surah}:${r.quran_ayah_from}`));
}

const APPROVED = new Set(["approved", "published"]);
export interface PublishCheck {
  status: string;
  encyclopediaKind: string | null;
  subjectEventId: string | null;
  claimStatuses: string[];
  reviewDecision: string | null;
}
export type PublishHint = "no_claims" | "unapproved_claims" | "needs_review";
/**
 * Reasons the database is expected to refuse publishing this person (a hint, never a permission). A person that joins the
 * encyclopedia (a kind or subject item set) needs approved claims; every person needs a scholarly approval.
 */
export function personPublishHints(p: PublishCheck): PublishHint[] {
  if (p.status === "published") return [];
  const out: PublishHint[] = [];
  if (p.encyclopediaKind || p.subjectEventId) {
    if (!p.claimStatuses.length) out.push("no_claims");
    else if (p.claimStatuses.some((s) => !APPROVED.has(s))) out.push("unapproved_claims");
  }
  if (p.reviewDecision !== "approved") out.push("needs_review");
  return out;
}

// ---------- Database refusals, in plain words ----------
const CONSTRAINT_TEXT: Array<[RegExp, number, string, string]> = [
  [/people_prophet_label/, 422, "prophet_label", KIND_ISSUE_TEXT.prophet_label],
  [/people_prophet_group/, 422, "prophet_group", KIND_ISSUE_TEXT.prophet_group],
  [/people_encyclopedia_kind_check/, 422, "kind_value", "That is not an encyclopedia kind."],
  [/people_subject_event|historical_communities_subject_event/, 409, "subject_taken", "That Event Universe item is already linked to another record."],
  [/person_claims_person_id_claim_id_key/, 409, "claim_taken", "That claim is already attached to this person."],
  [/person_aliases_pkey/, 409, "alias_taken", "That alias is already listed for this person."],
];

export interface Plain {
  status: number;
  code: string;
  message: string;
}
/**
 * The refusals this screen can cause, in plain words. A guard's own message (SQLSTATE P0001, for example "no evidence, no
 * publish: ..." or "no review, no publish: ...") is shown whole. null = not one of these; the caller falls back to the
 * generic mapping.
 */
export function plainRefusal(e: { code?: string; message?: string; details?: string } | null | undefined): Plain | null {
  if (!e) return null;
  const msg = e.message ?? "";
  if (e.code === "P0001" && msg) return { status: 422, code: "rule", message: msg };
  const hay = `${msg} ${e.details ?? ""}`;
  for (const [re, status, code, message] of CONSTRAINT_TEXT) if (re.test(hay)) return { status, code, message };
  return null;
}
