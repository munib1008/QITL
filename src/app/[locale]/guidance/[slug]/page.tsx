import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { GuidanceNotice, LessonView, MuftiLink, RelatedLinks, SafetyNotice, TopicIcon } from "@/components/guidance/Guidance";
import { topicPage } from "@/lib/data/guidance";
import { ShifaRelated } from "@/components/shifa/Related";
import { needsSafetyNotice, plannedTopic } from "@/lib/guidance/topics";
import { getDict } from "@/lib/i18n";
import { guidanceT } from "@/lib/i18n/modules/guidance";

export const revalidate = 300;

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const s = guidanceT(locale);
  const data = await topicPage(slug);
  const t = data?.topic ?? plannedTopic(slug);
  if (!t) return { title: s.kicker };
  return { title: `${locale === "ar" ? t.title_ar : t.title_en} · ${s.kicker}`, description: s.notice.body };
}

export default async function GuidanceTopicPage({ params }: { params: Params }) {
  const { locale: raw, slug } = await params;
  const { locale } = getDict(raw);
  const s = guidanceT(locale);
  const ar = locale === "ar";
  const data = await topicPage(slug);
  const topic = data?.topic ?? plannedTopic(slug);
  if (!topic) notFound();
  const lessons = data?.lessons ?? [];
  return (
    <ReadingPage
      locale={raw}
      crumbs={[{ href: "/guidance", label: s.kicker }, { label: ar ? topic.title_ar : topic.title_en }]}
      kicker={
        <span className="gd-kick">
          <TopicIcon icon={topic.icon_key} /> {s.kicker}
        </span>
      }
      title={ar ? topic.title_ar : topic.title_en}
      lead={data ? (ar ? data.topic.summary_ar : data.topic.summary_en) ?? undefined : undefined}
    >
      <div className="zq-pagebody gd-page">
        <GuidanceNotice s={s} />
        {needsSafetyNotice(topic) ? <SafetyNotice s={s} notes={data?.safety} locale={locale} /> : null}
        <section aria-labelledby="gd-lessons-h" className="gd-lessons">
          <h2 id="gd-lessons-h">{s.lessonsHeading}</h2>
          {lessons.length ? (
            lessons.map((l, i) => <LessonView key={l.id} lesson={l} s={s} locale={locale} index={i + 1} />)
          ) : (
            <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.inPreparation}</EvidenceLabel>} title={data === null ? s.emptyNotConnected : s.topicEmptyTitle}>
              <p>{s.topicEmptyBody}</p>
            </EmptyState>
          )}
        </section>
        {data ? <RelatedLinks links={data.links} s={s} locale={locale} /> : null}
        {data ? <ShifaRelated locale={locale} guidanceTopicId={data.topic.id} /> : null}
        <MuftiLink s={s} />
      </div>
    </ReadingPage>
  );
}
