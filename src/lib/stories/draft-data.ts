import raw from "@/generated/story-drafts.json";
import type { DraftIndex, PreviewStory } from "./draft-preview";

/**
 * The draft-preview data, imported at build time (no fs at request time, so it works on serverless). The file is written
 * by scripts/build-draft-index.ts; it holds only what the /drafts pages show.
 */
export const DRAFT_INDEX = raw as unknown as DraftIndex;

export const findDraft = (slug: string): PreviewStory | undefined => DRAFT_INDEX.stories.find((s) => s.slug === slug);

/** The Arabic ayat a story cites, nothing more (what the page hands to the browser). */
export function quranOf(story: PreviewStory): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of story.chapters)
    for (const r of c.verses)
      for (let a = r.from; a <= r.to; a++) {
        const k = `${r.surah}:${a}`;
        const t = DRAFT_INDEX.quran[k];
        if (t !== undefined) out[k] = t;
      }
  return out;
}

/** Robots rule of every draft page: unreviewed content is never indexed and its links are not followed. */
export const NOINDEX = { index: false, follow: false, googleBot: { index: false, follow: false } } as const;
