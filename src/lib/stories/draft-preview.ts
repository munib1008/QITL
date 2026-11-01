/**
 * Draft preview (/drafts): types and helpers shared by the index builder (Node), the pages and the tests. Client-safe
 * (no fs). The data itself is src/generated/story-drafts.json, written by scripts/build-draft-index.ts; the pages never
 * read content/stories or the database.
 *
 * These stories are unreviewed AI-written drafts. They are shown only as a clearly separate "Draft preview" and must
 * never be mixed with reviewed knowledge (docs/DRAFT_PREVIEW.md).
 */
import type { VerseRange } from "./draft";

export const SUBJECT_TYPES = ["prophet", "person", "community", "event", "parable", "seerah"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const parseSubjectType = (v: string | null | undefined): SubjectType | null => ((SUBJECT_TYPES as readonly string[]).includes(v ?? "") ? (v as SubjectType) : null);

export interface PreviewClaim {
  id: string;
  statement_en: string;
  verses: VerseRange[];
}

export interface PreviewChapter {
  anchor: string;
  position: number;
  title_en: string;
  verses: VerseRange[];
  claims: PreviewClaim[];
  summary_md: string;
  body_md: string;
  deep_md: string | null;
  kids_md: string | null;
  lessons_md: string | null;
  unknowns_md: string;
}

/** The automatic pre-review of a draft: what the validator found and counted. Not a scholarly review. */
export interface PreReview {
  errors: number;
  warnings: number;
  info: number;
  /** Every rule the validator can raise (from its source), the rules that raised something for this draft, and the rest. */
  rulesChecked: string[];
  rulesWithFindings: string[];
  rulesPassed: string[];
  claims: number;
  verseRanges: number;
  ayat: number;
}

export interface PreviewStory {
  slug: string;
  title_en: string;
  title_ar: string | null;
  type: SubjectType;
  chapters: PreviewChapter[];
  uncertainties_en: string[];
  preReview: PreReview;
}

export interface DraftIndex {
  version: 1;
  /** Attribution of the Arabic text (content/quran/source.json). */
  quranSource: { source: string; version: string };
  /** The 12-point scholar checklist of docs/STORY_DRAFTS.md, in order (Markdown with **bold** only). */
  checklist: string[];
  /** Arabic text, verbatim, of exactly the ayat the stories cite ("surah:ayah"). */
  quran: Record<string, string>;
  stories: PreviewStory[];
}

export const verseKey = (surah: number, ayah: number): string => `${surah}:${ayah}`;

/** The Arabic ayat of a range, in order, as far as the index holds them. */
export function rangeAyat(index: Pick<DraftIndex, "quran">, r: VerseRange): Array<{ ayah: number; text: string }> {
  const out: Array<{ ayah: number; text: string }> = [];
  for (let a = r.from; a <= r.to; a++) {
    const text = index.quran[verseKey(r.surah, a)];
    if (text) out.push({ ayah: a, text });
  }
  return out;
}

/** Display form of a range, "12:4" or "12:4-6" (an en dash is never used in the machine-readable parts). */
export const rangeLabel = (r: VerseRange): string => (r.from === r.to ? `${r.surah}:${r.from}` : `${r.surah}:${r.from}-${r.to}`);

export const claimDomId = (chapterAnchor: string, claimId: string): string => `claim-${chapterAnchor}-${claimId}`;
export const chapterDomId = (anchor: string): string => `chapter-${anchor}`;

const MARKER = /\[(c\d+(?:\s*,\s*c\d+)*)\]/g;

/**
 * Turns the claim markers of a draft text ([c3], [c1][c2], [c1, c2]) into links to the claim in the chapter's
 * evidence list. The text stays plain Markdown for the sanitising renderer; no HTML is produced here.
 */
export function linkClaimMarkers(md: string, chapterAnchor: string): string {
  return md
    .replace(MARKER, (_m, ids: string) =>
      ids
        .split(",")
        .map((s) => s.trim())
        .map((id) => `[${id}](#${claimDomId(chapterAnchor, id)})`)
        .join(" "),
    )
    .replace(/\)(\[c\d+\]\(#claim-)/g, ") $1");
}

export function groupByType(stories: PreviewStory[]): Array<{ type: SubjectType; stories: PreviewStory[] }> {
  return SUBJECT_TYPES.map((type) => ({ type, stories: stories.filter((s) => s.type === type) }));
}
