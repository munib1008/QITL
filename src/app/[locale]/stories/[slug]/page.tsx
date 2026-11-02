import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkedMedia } from "@/components/media/LinkedMedia";
import type { Locale } from "@/lib/i18n/dict";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { BookmarkButton } from "@/components/account/BookmarkButton";
import { DiscussionPreview } from "@/components/community/DiscussionPreview";
import { ChapterReader } from "@/components/story/ChapterReader";
import { e2eFixturesEnabled } from "@/lib/e2e-fixtures";
import { FIXTURE_STORY_SLUG, fixtureStory } from "@/lib/stories/fixture";
import { englishContent } from "@/lib/i18n/locales";
import { storiesStrings } from "@/lib/i18n/modules/prophets";
import { getServerSupabase } from "@/lib/supabase/server";
import { STORY_SELECT, toStoryData, type StoryData, type StoryRow } from "@/lib/stories/chapters";
import { parseMode } from "@/lib/stories/modes";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.replace(/-/g, " ") };
}

/**
 * A published story as its chapters: depth modes (?mode=summary|complete|deep|kids|lessons), a chapter list, one
 * anchor per chapter (#chapter-<anchor>) and "Sources and uncertainties". Only published chapters of a published story
 * are read; the database refuses anything else to a reader.
 */
export default async function StoryPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ chapter?: string; mode?: string }> }) {
  const { locale, slug } = await params;
  const { chapter, mode } = await searchParams;
  const t = storiesStrings(locale);
  const en = englishContent(locale);
  const sb = await getServerSupabase();
  let story: StoryData | null = null;
  if (sb) {
    const { data } = await sb
      .from("stories")
      .select(STORY_SELECT)
      .eq("slug", slug)
      .eq("status", "published")
      .eq("chapters.status", "published")
      .order("position", { referencedTable: "chapters" })
      .maybeSingle();
    story = data ? toStoryData(data as unknown as StoryRow) : null;
  } else if (e2eFixturesEnabled() && slug === FIXTURE_STORY_SLUG) {
    story = fixtureStory();
  }
  if (!story) notFound();
  const position = Number(chapter);

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ href: "/stories", label: t.title }, { label: story.title }]}
      title={<span {...en}>{story.title}</span>}
      lead={<span {...en}>{story.summary}</span>}
      meta={<BookmarkButton target={{ type: "story", id: story.slug }} />}
    >
      <LinkedMedia type="story" id={story.slug} locale={locale as Locale} />
      <ChapterReader slug={story.slug} chapters={story.chapters} initialMode={parseMode(mode)} initialPosition={Number.isInteger(position) && position > 0 ? position : null} />
      <section className="pp-sec" id="discuss" aria-labelledby="d-h">
        <h2 id="d-h">{t.discussion}</h2>
        <DiscussionPreview contentType="story" contentId={story.slug} />
      </section>
    </ReadingPage>
  );
}
