/**
 * Hadith stories, people and communities: shared types and pure helpers (no I/O), used by the loaders, the pages, the
 * admin screen and the tests. The database enforces the evidence rules (supabase/migrations/20261031002520..22); this
 * module mirrors the few the pages need so they show the right label and never guess.
 */
import { ayahHash } from "@/lib/refs";

export type Locale3 = "en" | "ar" | "ur";
export const SLUG_RE = /^[a-z0-9-]{2,80}$/;

export interface Localized {
  en: string | null;
  ar: string | null;
  ur: string | null;
}

export interface Picked {
  text: string | null;
  /** The language the text is actually in: an Arabic or Urdu page falls back to English and says so. */
  lang: Locale3;
  fallback: boolean;
}

/** The text in the page's language, or the English text marked as English (never a machine translation). */
export function pick(l: Localized, locale: string): Picked {
  const want: Locale3 = locale === "ar" ? "ar" : locale === "ur" ? "ur" : "en";
  const own = l[want]?.trim();
  if (own) return { text: own, lang: want, fallback: false };
  const en = l.en?.trim();
  return { text: en || null, lang: "en", fallback: want !== "en" && !!en };
}

/** A name pair: English first for English pages, Arabic (or the Arabic fallback) for Arabic and Urdu readers. */
export function nameLines(en: string, ar: string | null | undefined, locale: string): { main: string; mainLang: Locale3; alt: string | null; altLang: Locale3 } {
  const arabicFirst = locale === "ar" && !!ar;
  return arabicFirst ? { main: ar!, mainLang: "ar", alt: en, altLang: "en" } : { main: en, mainLang: "en", alt: ar?.trim() ? ar : null, altLang: "ar" };
}

// ---------- Hadith stories ----------
export const STORY_KINDS = ["clarifies_quranic_story", "separate_episode", "independent_lesson"] as const;
export type StoryKind = (typeof STORY_KINDS)[number];
export const isStoryKind = (v: string | null | undefined): v is StoryKind => !!v && (STORY_KINDS as readonly string[]).includes(v);

export interface NamedRef {
  slug: string;
  name_en: string;
  name_ar: string | null;
}
export interface ThemeRef {
  slug: string;
  title_en: string;
  title_ar: string | null;
}
export interface EventRef {
  slug: string;
  title: string;
  title_ar: string | null;
}

export interface StoryListItem {
  slug: string;
  title: Localized;
  narrator: Localized;
  kind: StoryKind;
  summary: Localized;
  people: NamedRef[];
  communities: NamedRef[];
  themes: ThemeRef[];
  /** "Sahih al-Bukhari 3" style reference of the primary narration, built from ids (never the text). */
  primary: { collection: string; number: string } | null;
}

export interface Grading {
  grader: string;
  grade: string;
  grade_label: string;
  citation: string | null;
}

export interface NarrationView {
  id: string;
  primary: boolean;
  variantNote: string | null;
  collection: string;
  number: string;
  numbering: string;
  /** Only present when the licence for the Arabic text is allowed (content_permissions); otherwise the page shows the reference only. */
  arabic: string | null;
  translation: { text: string; translator: string } | null;
  textAllowed: boolean;
  attribution: string | null;
  gradings: Grading[];
  /** The individual grading the story relies on (required for Tirmidhi and Ibn Majah). */
  relied: Grading | null;
}

export interface QuranConnection {
  claimId: string;
  statement: string | null;
  refs: Array<{ surah: number; from: number; to: number }>;
}

export interface StoryLesson {
  kind: "lesson" | "modern_application";
  body: Localized;
  position: number;
}

export interface StoryDetail extends StoryListItem {
  context: Localized;
  version: number;
  narrations: NarrationView[];
  quran: QuranConnection[];
  lessons: StoryLesson[];
  events: EventRef[];
}

export interface StoryFilters {
  theme?: string;
  narrator?: string;
  person?: string;
  community?: string;
  kind?: string;
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): StoryFilters {
  const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim().slice(0, 200);
  const slug = (v: string) => (SLUG_RE.test(v) ? v : undefined);
  const kind = one(sp.kind);
  return {
    theme: slug(one(sp.theme)),
    person: slug(one(sp.person)),
    community: slug(one(sp.community)),
    narrator: one(sp.narrator) || undefined,
    kind: isStoryKind(kind) ? kind : undefined,
  };
}

export const hasFilters = (f: StoryFilters): boolean => Object.values(f).some(Boolean);

export function filterStories(list: readonly StoryListItem[], f: StoryFilters): StoryListItem[] {
  return list.filter(
    (s) =>
      (!f.kind || s.kind === f.kind) &&
      (!f.narrator || (s.narrator.en ?? "").toLowerCase() === f.narrator.toLowerCase()) &&
      (!f.person || s.people.some((p) => p.slug === f.person)) &&
      (!f.community || s.communities.some((c) => c.slug === f.community)) &&
      (!f.theme || s.themes.some((t) => t.slug === f.theme)),
  );
}

export interface FilterOptions {
  themes: ThemeRef[];
  narrators: string[];
  people: NamedRef[];
  communities: NamedRef[];
  kinds: StoryKind[];
}

/** The choices a visitor can pick: only what the published stories actually carry. */
export function filterOptions(list: readonly StoryListItem[]): FilterOptions {
  const uniq = <T,>(items: T[], key: (t: T) => string) => [...new Map(items.map((i) => [key(i), i])).values()];
  return {
    themes: uniq(list.flatMap((s) => s.themes), (t) => t.slug).sort((a, b) => a.title_en.localeCompare(b.title_en)),
    narrators: [...new Set(list.map((s) => s.narrator.en).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b)),
    people: uniq(list.flatMap((s) => s.people), (p) => p.slug).sort((a, b) => a.name_en.localeCompare(b.name_en)),
    communities: uniq(list.flatMap((s) => s.communities), (c) => c.slug).sort((a, b) => a.name_en.localeCompare(b.name_en)),
    kinds: STORY_KINDS.filter((k) => list.some((s) => s.kind === k)),
  };
}

export interface LicenceRow {
  source_id: string;
  asset_type: string;
  scope: string;
  status: string;
  attribution_text: string | null;
}

/** public.content_permission_allowed: APPROVED, or CONDITIONAL with the attribution recorded. */
export function licenceAllows(rows: readonly LicenceRow[], sourceId: string | null | undefined, assetType: "text" | "translation"): { allowed: boolean; attribution: string | null } {
  if (!sourceId) return { allowed: false, attribution: null };
  const ok = rows.find((r) => r.source_id === sourceId && r.asset_type === assetType && r.scope === "all" && (r.status === "APPROVED" || (r.status === "CONDITIONAL" && !!r.attribution_text)));
  return { allowed: !!ok, attribution: ok?.attribution_text ?? null };
}

/** A collection id → its catalogue name, for a reference built from ids. */
export function narrationRef(collectionName: string, number: string): string {
  return `${collectionName.replace(/^Sahih |^Sunan |^Jami' /, "")} ${number}`;
}

/** Relied-on grading must be a named scholar's sahih / sahih li-ghayrihi for Tirmidhi and Ibn Majah. */
export function gradingMeetsRule(collection: string, relied: Pick<Grading, "grade" | "grader"> | null): boolean {
  if (collection === "bukhari" || collection === "muslim") return true;
  if (collection !== "tirmidhi" && collection !== "ibnmajah") return false;
  return !!relied && relied.grader.trim().length > 1 && (relied.grade === "sahih" || relied.grade === "sahih li-ghayrihi");
}

// ---------- People and communities ----------
export const PERSON_GROUPS = ["prophet", "individual", "family_member", "ruler", "unnamed"] as const;
export type PersonGroup = (typeof PERSON_GROUPS)[number];

/**
 * The group of a person comes from the data: a prophet only when the record's kind is 'prophet' (the database refuses the
 * label for anyone else), a family member, ruler or unnamed person only when an editor set it from the sources, and every
 * other non-prophet is simply an individual. Nothing is inferred from a name or a summary.
 */
export function personGroup(p: { kind: string; encyclopedia_kind: string | null }): PersonGroup {
  if (p.kind === "prophet") return "prophet";
  const k = p.encyclopedia_kind;
  return k === "family_member" || k === "ruler" || k === "unnamed" ? k : "individual";
}

export interface PersonListItem {
  slug: string;
  name_en: string;
  name_ar: string | null;
  honorific: string | null;
  kind: string;
  encyclopedia_kind: string | null;
  group: PersonGroup;
  name_source: "quran" | "later_tradition" | null;
}

export function groupPeople(list: readonly PersonListItem[]): Array<{ group: PersonGroup; items: PersonListItem[] }> {
  return PERSON_GROUPS.map((g) => ({ group: g, items: list.filter((p) => p.group === g).sort((a, b) => a.name_en.localeCompare(b.name_en)) })).filter((g) => g.items.length);
}

export interface VerseRange {
  surah: number;
  from: number;
  to: number;
}

export const verseLabel = (v: VerseRange): string => (v.from === v.to ? `${v.surah}:${v.from}` : `${v.surah}:${v.from}–${v.to}`);
/** Deep link to the reader; the ayah glows for three seconds on arrival (src/lib/refs.ts, ayah-highlight). */
export const verseHref = (v: VerseRange): string => `/quran/${v.surah}${ayahHash(v.from, v.to)}`;

export interface IdentificationView {
  kind: string;
  subject: string;
  view: string;
  standing: string;
}

/** The Event Universe item that IS the person or community: where "named in the Quran" comes from. */
export interface SubjectItem {
  slug: string;
  title: string;
  track: string;
  name_source: "quran" | "later_tradition";
  verses: VerseRange[];
  identifications: IdentificationView[];
}

export type IdentificationStatus = "named" | "later" | "unknown";
export const identificationStatus = (s: Pick<SubjectItem, "name_source"> | null): IdentificationStatus => (!s ? "unknown" : s.name_source === "later_tradition" ? "later" : "named");

export interface EvidenceBlock {
  claimId: string;
  statement: string | null;
  evidence: string | null;
  verses: VerseRange[];
}

export interface FamilyEdge {
  kind: "parent_of" | "spouse_of" | "sibling_of" | "descendant_of";
  /** "out": this person is the subject of the edge (parent_of: this person is the parent). */
  direction: "out" | "in";
  other: NamedRef;
  confidence: string;
  statement: string | null;
  competing: boolean;
}

export interface RelatedEvent extends EventRef {
  role: string | null;
}

export interface PersonPage {
  slug: string;
  name_en: string;
  name_ar: string | null;
  honorific: string | null;
  summary: string | null;
  kind: string;
  encyclopedia_kind: string | null;
  group: PersonGroup;
  aliases: Array<{ alias: string; language: string }>;
  evidence: EvidenceBlock[];
  subject: SubjectItem | null;
  family: FamilyEdge[];
  events: RelatedEvent[];
  hadithStories: StoryListItem[];
  lifespan: { value: string | null; known: boolean } | null;
  /** The prophet's own journey page, when the site has one under the same address. */
  journeyHref: string | null;
}

export interface CommunityListItem {
  slug: string;
  name_en: string;
  name_ar: string | null;
  name_source: "quran" | "later_tradition" | null;
}

export interface CommunityPage {
  slug: string;
  name_en: string;
  name_ar: string | null;
  summary: string | null;
  era: string | null;
  place: string | null;
  evidence: EvidenceBlock[];
  subject: SubjectItem | null;
  events: RelatedEvent[];
  hadithStories: StoryListItem[];
}

export interface EncyclopediaCounts {
  published: number;
  under_review: number;
}

/** Verses of the evidence blocks and the subject item, each range once, in mushaf order. */
export function allVerses(evidence: readonly EvidenceBlock[], subject: SubjectItem | null): VerseRange[] {
  const seen = new Map<string, VerseRange>();
  for (const v of [...evidence.flatMap((e) => e.verses), ...(subject?.verses ?? [])]) seen.set(verseLabel(v), v);
  return [...seen.values()].sort((a, b) => a.surah - b.surah || a.from - b.from || a.to - b.to);
}

export const RELATION_KINDS = ["parent_of", "spouse_of", "sibling_of", "descendant_of"] as const;

/** The label key of an edge as seen from this person ("parent_of" out = "Parent of"; in = "Child of"). */
export function relationKey(e: Pick<FamilyEdge, "kind" | "direction">): string {
  if (e.direction === "out") return e.kind;
  return e.kind === "parent_of" ? "parent_of_in" : e.kind === "descendant_of" ? "descendant_of_in" : e.kind;
}
