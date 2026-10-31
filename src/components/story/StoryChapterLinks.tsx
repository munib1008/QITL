import Link from "next/link";
import { englishContent } from "@/lib/i18n/locales";
import { storyChaptersStrings } from "@/lib/i18n/modules/storyChapters";
import type { LinkedStory } from "@/lib/data/story-links";

/** Chapter links into the full, chaptered story (each chapter has its own anchor and reading modes there). */
export function StoryChapterLinks({ stories, locale }: { stories: LinkedStory[]; locale: string }) {
  if (!stories.length) return null;
  const t = storyChaptersStrings(locale);
  const en = englishContent(locale);
  return (
    <section className="pp-sec" aria-labelledby="chapters-of-story-h" data-testid="linked-chapters">
      <h2 id="chapters-of-story-h">{t.linkedHeading}</h2>
      {stories.map((s) => (
        <div key={s.slug} className="pp-card">
          <h3>
            <Link href={`/stories/${s.slug}`} {...en}>
              {s.title}
            </Link>
          </h3>
          <ol style={{ margin: 0, paddingInlineStart: 20 }}>
            {s.chapters.map((c) => (
              <li key={c.anchor}>
                <Link href={`/stories/${s.slug}#chapter-${c.anchor}`} {...en}>
                  {c.title}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
