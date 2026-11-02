import type { ReactNode } from "react";
import Link from "next/link";
import { DraftBanner } from "@/components/drafts/DraftBanner";
import { DraftReader } from "@/components/drafts/DraftReader";
import { publicAiDraftGate } from "@/lib/stories/ai-draft-gate";
import { findDraft, quranOf } from "@/lib/stories/draft-data";
import { DEFAULT_MODE } from "@/lib/stories/modes";
import { draftPreviewStrings } from "@/lib/i18n/modules/draftPreview";

/**
 * The full story of a prophet or event while no reviewed story is published: the public AI draft, under the draft banner
 * ("AI draft, review pending"), when the database has released it. Otherwise the fallback (the "not yet written" state).
 * Never shown as reviewed: the banner cannot be hidden.
 */
export async function AiDraftStory({ slug, locale, fallback }: { slug: string; locale: string; fallback: ReactNode }) {
  const gate = await publicAiDraftGate();
  const story = gate?.has(slug) ? findDraft(slug) : null;
  if (!story) return <>{fallback}</>;
  const t = draftPreviewStrings(locale);
  return (
    <div data-testid="ai-draft-story">
      <DraftBanner locale={locale} preReviewLink={false} />
      <DraftReader chapters={story.chapters} quran={quranOf(story)} uncertainties={story.uncertainties_en} initialMode={DEFAULT_MODE} />
      <p className="zq-meta">
        <Link href={`/drafts/${story.slug}`}>{t.draftWord}</Link>
      </p>
    </div>
  );
}
