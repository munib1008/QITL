/**
 * The published chapters of a story, shaped for the reader. Pure (the page fetches the rows).
 */
import type { EvidenceKind } from "@/content/labels";
import type { Ref } from "@/lib/data/story-types";

export interface ChapterClaim {
  id: string;
  statement: string;
  evidence: EvidenceKind;
  refs: Ref[];
}
export interface ChapterData {
  id: string;
  position: number;
  anchor: string;
  title: string;
  eventSlug: string | null;
  eventTitle: string | null;
  bodyMd: string;
  summaryMd: string | null;
  deepMd: string | null;
  kidsMd: string | null;
  lessonsMd: string | null;
  unknownsMd: string | null;
  claims: ChapterClaim[];
}
export interface StoryData {
  id: string;
  slug: string;
  title: string;
  titleAr: string | null;
  summary: string;
  chapters: ChapterData[];
}

export const CHAPTER_SELECT =
  "id, position, anchor, title, body_md, summary_md, deep_md, kids_md, lessons_md, unknowns_md, historical_events(slug, title), " +
  "chapter_claims(evidence_claims(id, statement, evidence, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, locator, sources(work), hadith_entries(collection_id, canonical_number), hadith_gradings(grade_label, grader))))";
export const STORY_SELECT = `id, slug, title, title_ar, summary, chapters(${CHAPTER_SELECT})`;

interface RefRow {
  kind: string;
  quran_surah: number | null;
  quran_ayah_from: number | null;
  quran_ayah_to: number | null;
  locator: string | null;
  sources: { work: string } | null;
  hadith_entries: { collection_id: string; canonical_number: string } | null;
  hadith_gradings: { grade_label: string; grader: string } | null;
}
interface ChapterRow {
  id: string;
  position: number;
  anchor: string;
  title: string;
  body_md: string;
  summary_md: string | null;
  deep_md: string | null;
  kids_md: string | null;
  lessons_md: string | null;
  unknowns_md: string | null;
  historical_events: { slug: string; title: string } | null;
  chapter_claims: Array<{ evidence_claims: { id: string; statement: string; evidence: EvidenceKind; claim_references: RefRow[] } | null }>;
}
export interface StoryRow {
  id: string;
  slug: string;
  title: string;
  title_ar: string | null;
  summary: string;
  chapters: ChapterRow[];
}

function toRef(r: RefRow): Ref {
  return {
    kind: r.kind,
    surah: r.quran_surah,
    from: r.quran_ayah_from,
    to: r.quran_ayah_to,
    locator: r.locator,
    work: r.sources?.work ?? null,
    hadith: r.hadith_entries ? { collection: r.hadith_entries.collection_id, number: r.hadith_entries.canonical_number, grade: r.hadith_gradings?.grade_label ?? null, grader: r.hadith_gradings?.grader ?? null } : null,
  };
}

export function toStoryData(row: StoryRow): StoryData {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleAr: row.title_ar,
    summary: row.summary,
    chapters: [...row.chapters]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        position: c.position,
        anchor: c.anchor,
        title: c.title,
        eventSlug: c.historical_events?.slug ?? null,
        eventTitle: c.historical_events?.title ?? null,
        bodyMd: c.body_md,
        summaryMd: c.summary_md,
        deepMd: c.deep_md,
        kidsMd: c.kids_md,
        lessonsMd: c.lessons_md,
        unknownsMd: c.unknowns_md,
        claims: c.chapter_claims.flatMap((cc) => (cc.evidence_claims ? [{ id: cc.evidence_claims.id, statement: cc.evidence_claims.statement, evidence: cc.evidence_claims.evidence, refs: cc.evidence_claims.claim_references.map(toRef) }] : [])),
      })),
  };
}

/** The DOM id of a chapter: /stories/<slug>#chapter-<anchor>. */
export const chapterDomId = (c: Pick<ChapterData, "anchor">) => `chapter-${c.anchor}`;

/** A chapter's own verse references: the Quran references of its claims, merged and sorted. */
export function chapterVerseRefs(c: Pick<ChapterData, "claims">): Ref[] {
  const seen = new Map<string, Ref>();
  for (const claim of c.claims)
    for (const r of claim.refs)
      if (r.kind === "quran" && r.surah && r.from) seen.set(`${r.surah}:${r.from}-${r.to ?? r.from}`, r);
  return [...seen.values()].sort((a, b) => a.surah! - b.surah! || a.from! - b.from!);
}

/** Every distinct source of a story, for "Sources and uncertainties". */
export function storySources(chapters: Array<Pick<ChapterData, "claims">>): Ref[] {
  const seen = new Map<string, Ref>();
  for (const c of chapters)
    for (const claim of c.claims)
      for (const r of claim.refs) seen.set(`${r.kind}|${r.surah}|${r.from}|${r.to}|${r.hadith?.collection}|${r.hadith?.number}|${r.work}|${r.locator}`, r);
  return [...seen.values()];
}

/** Chapter anchor from a legacy ?chapter=N position (older links). */
export function anchorForPosition(chapters: ChapterData[], pos: number): string | null {
  return chapters.find((c) => c.position === pos)?.anchor ?? null;
}
