import { findDraft } from "@/lib/stories/draft-data";

/** Journey page ids that differ from the story-draft slug. */
const ALIAS: Record<string, string> = { dhulkifl: "dhul-kifl", zakariya: "zakariyya" };
export const draftSlugFor = (id: string): string => ALIAS[id] ?? id;

export interface DraftOutlineStep {
  title: string;
  summary: string;
  refs: Array<{ surah: number; from: number; to: number }>;
}

/** The claim markers ([c1]) are for the evidence panel; they are not part of a reader-facing summary. */
const plain = (s: string) => s.replace(/\s*(\[c\d+\])+/g, "").replace(/\s+([.,;:])/g, "$1").trim();

/** An outline for a prophet page, taken from the chapters of the story draft: chapter title, its summary, and the verses it cites. */
export function draftOutline(slug: string): DraftOutlineStep[] | null {
  const d = findDraft(draftSlugFor(slug));
  if (!d?.chapters?.length) return null;
  return d.chapters.map((c) => ({
    title: c.title_en,
    summary: plain(c.summary_md ?? ""),
    refs: (c.verses ?? []).map((v) => ({ surah: v.surah, from: v.from, to: v.to ?? v.from })),
  }));
}
