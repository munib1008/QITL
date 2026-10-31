/**
 * Database rows → page models for hadith stories, people and communities (pure, so it is unit-tested). Rows arrive through
 * the public client, so row-level security has already removed every unpublished record: an unpublished person or event
 * embedded in a row arrives as null and is dropped here, never shown as a bare id.
 */
import { COLLECTIONS } from "@/lib/data/hadith";
import {
  gradingMeetsRule,
  isStoryKind,
  licenceAllows,
  narrationRef,
  personGroup,
  type CommunityListItem,
  type EvidenceBlock,
  type EventRef,
  type FamilyEdge,
  type Grading,
  type IdentificationView,
  type LicenceRow,
  type Localized,
  type NamedRef,
  type NarrationView,
  type PersonListItem,
  type QuranConnection,
  type RelatedEvent,
  type StoryDetail,
  type StoryLesson,
  type StoryListItem,
  type SubjectItem,
  type ThemeRef,
  type VerseRange,
} from "./model";

type Nullable<T> = T | null;
const loc = (en: Nullable<string>, ar: Nullable<string>, ur: Nullable<string>): Localized => ({ en, ar, ur });
const collectionName = (id: string) => COLLECTIONS.find((c) => c.id === id)?.name ?? id;

// ---------- Hadith stories ----------
export interface StoryRow {
  slug: string;
  title_en: string;
  title_ar: Nullable<string>;
  title_ur: Nullable<string>;
  narrator_en: Nullable<string>;
  narrator_ar: Nullable<string>;
  narrator_ur: Nullable<string>;
  kind: string;
  summary_en: Nullable<string>;
  summary_ar: Nullable<string>;
  summary_ur: Nullable<string>;
  context_en?: Nullable<string>;
  context_ar?: Nullable<string>;
  context_ur?: Nullable<string>;
  version?: number;
  hadith_story_entries?: Array<{
    id?: string;
    is_primary: boolean;
    variant_note?: Nullable<string>;
    position?: number;
    selected?: Nullable<Grading>;
    hadith_entries: Nullable<{
      id?: string;
      collection_id: string;
      canonical_number: string;
      numbering_system?: string;
      arabic?: string;
      source_versions?: Nullable<{ source_id: string }>;
      hadith_gradings?: Grading[];
      hadith_translations?: Array<{ translator: string; language: string; text: string; source_id: string }>;
    }>;
  }>;
  hadith_story_links?: Array<{
    target_kind: string;
    position?: number;
    people?: Nullable<NamedRef>;
    historical_communities?: Nullable<NamedRef>;
    historical_events?: Nullable<EventRef>;
    guidance_topics?: Nullable<ThemeRef>;
  }>;
  hadith_story_claims?: Array<{
    position?: number;
    evidence_claims: Nullable<{
      id: string;
      statement: Nullable<string>;
      claim_references: Array<{ kind: string; quran_surah: Nullable<number>; quran_ayah_from: Nullable<number>; quran_ayah_to: Nullable<number> }>;
    }>;
  }>;
  hadith_story_lessons?: Array<{ kind: string; body_en: string; body_ar: Nullable<string>; body_ur: Nullable<string>; position: number }>;
}

export const STORY_LIST_SELECT =
  "slug, title_en, title_ar, title_ur, narrator_en, narrator_ar, narrator_ur, kind, summary_en, summary_ar, summary_ur, " +
  "hadith_story_entries(is_primary, hadith_entries(collection_id, canonical_number)), " +
  "hadith_story_links(target_kind, people(slug, name_en, name_ar), historical_communities(slug, name_en, name_ar), guidance_topics(slug, title_en, title_ar))";

export const STORY_DETAIL_SELECT =
  "slug, title_en, title_ar, title_ur, narrator_en, narrator_ar, narrator_ur, kind, summary_en, summary_ar, summary_ur, context_en, context_ar, context_ur, version, " +
  "hadith_story_entries(id, is_primary, variant_note, position, selected:hadith_gradings(grader, grade, grade_label, citation), " +
  "hadith_entries(id, collection_id, canonical_number, numbering_system, arabic, source_versions(source_id), hadith_gradings(grader, grade, grade_label, citation), hadith_translations(translator, language, text, source_id))), " +
  "hadith_story_claims(position, evidence_claims(id, statement, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to))), " +
  "hadith_story_lessons(kind, body_en, body_ar, body_ur, position), " +
  "hadith_story_links(target_kind, position, people(slug, name_en, name_ar), historical_communities(slug, name_en, name_ar), historical_events(slug, title, title_ar), guidance_topics(slug, title_en, title_ar))";

export function storyListItem(r: StoryRow): StoryListItem | null {
  if (!isStoryKind(r.kind)) return null;
  const links = r.hadith_story_links ?? [];
  const primaryRow = (r.hadith_story_entries ?? []).find((e) => e.is_primary && e.hadith_entries);
  return {
    slug: r.slug,
    title: loc(r.title_en, r.title_ar, r.title_ur),
    narrator: loc(r.narrator_en, r.narrator_ar, r.narrator_ur),
    kind: r.kind,
    summary: loc(r.summary_en, r.summary_ar, r.summary_ur),
    people: links.filter((l) => l.people).map((l) => l.people!),
    communities: links.filter((l) => l.historical_communities).map((l) => l.historical_communities!),
    themes: links.filter((l) => l.guidance_topics).map((l) => l.guidance_topics!),
    primary: primaryRow?.hadith_entries ? { collection: collectionName(primaryRow.hadith_entries.collection_id), number: primaryRow.hadith_entries.canonical_number } : null,
  };
}

function quranRefs(refs: Array<{ kind: string; quran_surah: Nullable<number>; quran_ayah_from: Nullable<number>; quran_ayah_to: Nullable<number> }>): VerseRange[] {
  return refs
    .filter((x) => x.kind === "quran" && x.quran_surah && x.quran_ayah_from)
    .map((x) => ({ surah: x.quran_surah!, from: x.quran_ayah_from!, to: x.quran_ayah_to ?? x.quran_ayah_from! }));
}

/**
 * The full story. A narration's Arabic text and any translation are carried only when content_permissions allows that
 * asset for the narration's source; otherwise the narration is a reference with its gradings (the licence is pending).
 */
export function storyDetail(r: StoryRow, licences: readonly LicenceRow[]): StoryDetail | null {
  const base = storyListItem(r);
  if (!base) return null;
  const entries = [...(r.hadith_story_entries ?? [])].filter((e) => e.hadith_entries).sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || (a.position ?? 0) - (b.position ?? 0));
  const narrations: NarrationView[] = entries.map((e) => {
    const h = e.hadith_entries!;
    const text = licenceAllows(licences, h.source_versions?.source_id, "text");
    const tr = (h.hadith_translations ?? []).find((t) => licenceAllows(licences, t.source_id, "translation").allowed && t.language === "en");
    const relied = e.selected ?? null;
    return {
      id: e.id ?? `${h.collection_id}:${h.canonical_number}`,
      primary: e.is_primary,
      variantNote: e.variant_note ?? null,
      collection: h.collection_id,
      number: h.canonical_number,
      numbering: h.numbering_system ?? "",
      arabic: text.allowed ? (h.arabic ?? null) : null,
      translation: text.allowed && tr ? { text: tr.text, translator: tr.translator } : null,
      textAllowed: text.allowed,
      attribution: text.attribution,
      gradings: h.hadith_gradings ?? [],
      relied: relied && gradingMeetsRule(h.collection_id, relied) ? relied : null,
    };
  });
  const quran: QuranConnection[] = (r.hadith_story_claims ?? [])
    .filter((c) => c.evidence_claims)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((c) => ({ claimId: c.evidence_claims!.id, statement: c.evidence_claims!.statement, refs: quranRefs(c.evidence_claims!.claim_references ?? []) }))
    .filter((c) => c.refs.length);
  const lessons: StoryLesson[] = [...(r.hadith_story_lessons ?? [])]
    .filter((l) => l.kind === "lesson" || l.kind === "modern_application")
    .sort((a, b) => a.position - b.position)
    .map((l) => ({ kind: l.kind as StoryLesson["kind"], body: loc(l.body_en, l.body_ar, l.body_ur), position: l.position }));
  return {
    ...base,
    context: loc(r.context_en ?? null, r.context_ar ?? null, r.context_ur ?? null),
    version: r.version ?? 1,
    narrations,
    quran,
    lessons,
    events: (r.hadith_story_links ?? []).filter((l) => l.historical_events).map((l) => l.historical_events!),
  };
}

export const referenceOf = (n: Pick<NarrationView, "collection" | "number">): string => narrationRef(collectionName(n.collection), n.number);

// ---------- People and communities ----------
export interface SubjectRow {
  slug: string;
  title: string;
  track: string;
  name_source: "quran" | "later_tradition";
  status?: string;
  event_verse_refs?: Array<{ surah: number; ayah_from: number; ayah_to: number; position?: number }>;
  event_identifications?: Array<{ kind: string; subject: string; view: string; standing: string; status: string }>;
}

export const SUBJECT_SELECT = "slug, title, track, name_source, status, event_verse_refs(surah, ayah_from, ayah_to, position), event_identifications(kind, subject, view, standing, status)";

export function subjectItem(r: Nullable<SubjectRow> | undefined): SubjectItem | null {
  if (!r || (r.status && r.status !== "published")) return null;
  const identifications: IdentificationView[] = (r.event_identifications ?? [])
    .filter((i) => i.status === "published")
    .map(({ kind, subject, view, standing }) => ({ kind, subject, view, standing }));
  return {
    slug: r.slug,
    title: r.title,
    track: r.track,
    name_source: r.name_source,
    verses: [...(r.event_verse_refs ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.surah - b.surah || a.ayah_from - b.ayah_from).map((v) => ({ surah: v.surah, from: v.ayah_from, to: v.ayah_to })),
    identifications,
  };
}

export interface ClaimRow {
  id: string;
  statement: Nullable<string>;
  evidence: Nullable<string>;
  status?: string;
  claim_references?: Array<{ kind: string; quran_surah: Nullable<number>; quran_ayah_from: Nullable<number>; quran_ayah_to: Nullable<number> }>;
}
export const CLAIM_SELECT = "id, statement, evidence, status, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to)";

export function evidenceBlock(c: Nullable<ClaimRow> | undefined): EvidenceBlock | null {
  if (!c || (c.status && c.status !== "approved" && c.status !== "published")) return null;
  return { claimId: c.id, statement: c.statement, evidence: c.evidence, verses: quranRefs(c.claim_references ?? []) };
}

export interface PersonRow {
  slug: string;
  name_en: string;
  name_ar: Nullable<string>;
  honorific: Nullable<string>;
  summary?: Nullable<string>;
  kind: string;
  encyclopedia_kind: Nullable<string>;
  subject?: Nullable<SubjectRow>;
}

export function personListItem(r: PersonRow): PersonListItem {
  return {
    slug: r.slug,
    name_en: r.name_en,
    name_ar: r.name_ar,
    honorific: r.honorific,
    kind: r.kind,
    encyclopedia_kind: r.encyclopedia_kind,
    group: personGroup(r),
    name_source: r.subject && (!r.subject.status || r.subject.status === "published") ? r.subject.name_source : null,
  };
}

export interface EdgeRow {
  kind: string;
  confidence: string;
  competing_group: Nullable<string>;
  from: Nullable<NamedRef & { status?: string }>;
  to: Nullable<NamedRef & { status?: string }>;
  evidence_claims: Nullable<{ statement: Nullable<string> }>;
}

/** Edges seen from one person; an edge whose other end is not published is dropped, never half-shown. */
export function familyEdges(slug: string, rows: readonly EdgeRow[]): FamilyEdge[] {
  const out: FamilyEdge[] = [];
  for (const e of rows) {
    if (e.kind !== "parent_of" && e.kind !== "spouse_of" && e.kind !== "sibling_of" && e.kind !== "descendant_of") continue;
    if (!e.from || !e.to) continue;
    const mine = e.from.slug === slug ? "out" : e.to.slug === slug ? "in" : null;
    if (!mine) continue;
    const other = mine === "out" ? e.to : e.from;
    out.push({ kind: e.kind, direction: mine, other: { slug: other.slug, name_en: other.name_en, name_ar: other.name_ar }, confidence: e.confidence, statement: e.evidence_claims?.statement ?? null, competing: !!e.competing_group });
  }
  return out;
}

export function relatedEvents(rows: ReadonlyArray<{ role?: Nullable<string>; historical_events: Nullable<EventRef & { status?: string }> }>, exclude?: string): RelatedEvent[] {
  const seen = new Set<string>(exclude ? [exclude] : []);
  const out: RelatedEvent[] = [];
  for (const r of rows) {
    const e = r.historical_events;
    if (!e || (e.status && e.status !== "published") || seen.has(e.slug)) continue;
    seen.add(e.slug);
    out.push({ slug: e.slug, title: e.title, title_ar: e.title_ar, role: r.role ?? null });
  }
  return out;
}

export interface CommunityRow {
  slug: string;
  name_en: string;
  name_ar: Nullable<string>;
  subject?: Nullable<SubjectRow>;
}
export function communityListItem(r: CommunityRow): CommunityListItem {
  return { slug: r.slug, name_en: r.name_en, name_ar: r.name_ar, name_source: r.subject && (!r.subject.status || r.subject.status === "published") ? r.subject.name_source : null };
}
