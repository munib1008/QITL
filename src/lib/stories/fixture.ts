import type { ChapterData, StoryData } from "./chapters";

/** Address of the synthetic story used by the browser tests (see fixtureStory). */
export const FIXTURE_STORY_SLUG = "fixture-story";

/**
 * A synthetic story for the browser tests of chapters and depth modes. Every text is a labelled placeholder, not
 * Quran, hadith or story text; the verse numbers only exercise the link format. Chapter 2 has a complete text only
 * and chapter 3 has no text at all, to show the "not established" states.
 */
export function fixtureStory(): StoryData {
  const ref = (surah: number, from: number, to: number | null) => ({ kind: "quran", surah, from, to, hadith: null, locator: null, work: null });
  const T = "[TEST FIXTURE — placeholder, not Quran or hadith text]";
  const chapter = (n: number, extra: Partial<ChapterData>): ChapterData => ({
    id: `fixture-chapter-${n}`,
    position: n,
    anchor: `part-${n}`,
    title: `${T} Chapter ${n}`,
    eventSlug: null,
    eventTitle: null,
    bodyMd: "",
    summaryMd: null,
    deepMd: null,
    kidsMd: null,
    lessonsMd: null,
    unknownsMd: null,
    claims: [{ id: `fixture-claim-${n}`, statement: `${T} Synthetic claim ${n}.`, evidence: "quran", refs: [ref(1, n, n + 1)] }],
    ...extra,
  });
  return {
    id: "fixture-story",
    slug: FIXTURE_STORY_SLUG,
    title: `${T} Story`,
    titleAr: null,
    summary: `${T} A synthetic story for the automated tests.`,
    chapters: [
      chapter(1, {
        bodyMd: `${T} Complete text of chapter one.`,
        summaryMd: `${T} One-minute summary of chapter one.`,
        deepMd: `${T} Deep-study notes of chapter one.`,
        kidsMd: `${T} Kids version of chapter one.`,
        lessonsMd: `${T} Life lesson of chapter one.`,
        unknownsMd: `${T} A point the sources do not establish.`,
        eventSlug: "fixture-event",
        eventTitle: `${T} Event`,
      }),
      chapter(2, { bodyMd: `${T} Complete text of chapter two, with no other mode written.` }),
      chapter(3, {}),
    ],
  };
}
