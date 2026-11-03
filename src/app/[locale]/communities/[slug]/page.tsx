import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiDraftStory } from "@/components/drafts/AiDraftStory";
import { redirectIfPublicAiDraft } from "@/lib/stories/ai-draft-gate";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EventsSection, IdentificationBlock, Name, NotEstablished, QuranSection, StoryLinks } from "@/components/encyclopedia/Encyclopedia";
import { EmptyState } from "@/components/ui/misc";
import { communityBySlug } from "@/lib/data/encyclopedia";
import { SLUG_RE } from "@/lib/encyclopedia/model";
import { getDict } from "@/lib/i18n";
import { encyclopediaStrings } from "@/lib/i18n/modules/encyclopedia";
import { hadithStoryStrings } from "@/lib/i18n/modules/hadithStories";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = encyclopediaStrings(locale);
  const c = SLUG_RE.test(slug) ? await communityBySlug(slug) : undefined;
  return c ? { title: c.name_en, description: c.summary ?? t.communities.lead } : { title: t.communities.title };
}

export default async function CommunityPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const { locale } = getDict(raw);
  const t = encyclopediaStrings(locale);
  const hs = hadithStoryStrings(locale);
  if (!SLUG_RE.test(slug)) notFound();
  const c = await communityBySlug(slug);
  const crumbs = [{ href: "/communities", label: t.communities.crumb }];
  if (c === null)
    return (
      <ReadingPage locale={raw} crumbs={[...crumbs, { label: t.communities.title }]} title={t.communities.title}>
        <div className="zq-pagebody">
          <EmptyState title={t.communities.notConnected} />
        </div>
      </ReadingPage>
    );
  if (!c) {
    await redirectIfPublicAiDraft(slug);
    notFound();
  }
  const s = t.sections;
  return (
    <ReadingPage
      locale={raw}
      crumbs={[...crumbs, { label: c.name_en }]}
      kicker={t.communities.kicker}
      title={<Name en={c.name_en} ar={c.name_ar} locale={locale} />}
      lead={c.summary ? <span lang="en" dir="ltr">{c.summary}</span> : undefined}
    >
      <div className="zq-pagebody he-page">
        <IdentificationBlock subject={c.subject} t={t} locale={locale} />
        <QuranSection evidence={c.evidence} subject={c.subject} t={t} lang={locale} />
        <EventsSection events={c.events} t={t} locale={locale} />
        <StoryLinks stories={c.hadithStories} locale={locale} t={hs} title={s.hadithStories} empty={s.noHadithStories} />
        <NotEstablished
          t={t}
          items={[
            { label: t.communities.period, value: c.era },
            { label: t.communities.place, value: c.place },
          ]}
        />
        <AiDraftStory slug={slug} locale={raw} fallback={null} />
        <p>
          <Link className="zq-btn zq-btn-quiet zq-btn-link" href="/life-through-ages">
            {t.communities.lifeLink}
          </Link>{" "}
          <Link className="zq-btn zq-btn-secondary zq-btn-link" href="/communities">
            {s.back}
          </Link>
        </p>
      </div>
    </ReadingPage>
  );
}
