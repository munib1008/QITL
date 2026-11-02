import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DraftBanner } from "@/components/drafts/DraftBanner";
import { DraftReader } from "@/components/drafts/DraftReader";
import { PreReviewPanel } from "@/components/drafts/PreReviewPanel";
import { LinkedMedia } from "@/components/media/LinkedMedia";
import type { Locale } from "@/lib/i18n/dict";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { englishContent } from "@/lib/i18n/locales";
import { draftPreviewStrings } from "@/lib/i18n/modules/draftPreview";
import { DRAFT_INDEX, NOINDEX, findDraft, quranOf } from "@/lib/stories/draft-data";
import { DEFAULT_MODE, parseMode } from "@/lib/stories/modes";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = draftPreviewStrings(locale);
  const s = findDraft(slug);
  if (!s) return { title: t.draftWord, robots: NOINDEX };
  return { title: `${s.title_en} · ${t.draftWord}`, description: t.storyMeta, robots: NOINDEX };
}

/** One story draft: banner, the reader (modes, chapters, cited ayat, evidence), the AI pre-review and the attribution. */
export default async function DraftPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { locale, slug } = await params;
  const { mode } = await searchParams;
  const story = findDraft(slug);
  if (!story) notFound();
  const t = draftPreviewStrings(locale);
  const en = englishContent(locale);

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ href: "/drafts", label: t.crumbHome }, { label: story.title_en }]}
      kicker={
        <span>
          {t.draftWord} · {t.types[story.type]![1]}
        </span>
      }
      title={
        <>
          <span {...en}>{story.title_en}</span>
          {story.title_ar ? (
            <>
              {" "}
              <span lang="ar" dir="rtl" className="zq-prophet-ar">
                {story.title_ar}
              </span>
            </>
          ) : null}
        </>
      }
      lead={t.storyMeta}
    >
      <DraftBanner locale={locale} preReviewLink />
      <LinkedMedia type="story" id={story.slug} locale={locale as Locale} />
      <DraftReader chapters={story.chapters} quran={quranOf(story)} uncertainties={story.uncertainties_en} initialMode={parseMode(typeof mode === "string" ? mode : null) ?? DEFAULT_MODE} />
      <PreReviewPanel locale={locale} pre={story.preReview} checklist={DRAFT_INDEX.checklist} />
      <QuranAttribution src={DRAFT_INDEX.quranSource} />
    </ReadingPage>
  );
}
