import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { GuidanceNotice, MuftiLink, TopicCard } from "@/components/guidance/Guidance";
import { publishedTopics } from "@/lib/data/guidance";
import { PLANNED_TOPICS } from "@/lib/guidance/topics";
import { getDict } from "@/lib/i18n";
import { guidanceT } from "@/lib/i18n/modules/guidance";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = guidanceT((await params).locale);
  return { title: s.kicker, description: s.lead };
}

export default async function GuidanceIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const s = guidanceT(locale);
  const ar = locale === "ar";
  const topics = await publishedTopics();
  const published = new Set((topics ?? []).map((t) => t.slug));
  const planned = PLANNED_TOPICS.filter((t) => !published.has(t.slug));
  return (
    <ReadingPage locale={raw} crumbs={[{ label: s.kicker }]} kicker={s.kicker} title={s.title} lead={s.lead}>
      <div className="zq-pagebody gd-page">
        <GuidanceNotice s={s} />
        {topics?.length ? (
          <section aria-labelledby="gd-topics-h">
            <h2 id="gd-topics-h" className="zq-eyebrow">
              {s.topicsHeading}
            </h2>
            <ul className="gd-grid" data-testid="topic-grid">
              {topics.map((t) => (
                <TopicCard
                  key={t.slug}
                  href={`/guidance/${t.slug}`}
                  icon={t.icon_key}
                  title={ar ? t.title_ar : t.title_en}
                  alt={ar ? t.title_en : t.title_ar}
                  altLang={ar ? "en" : "ar"}
                />
              ))}
            </ul>
          </section>
        ) : (
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.inPreparation}</EvidenceLabel>} title={topics ? s.emptyTitle : s.emptyNotConnected}>
            <p>{s.emptyBody}</p>
          </EmptyState>
        )}
        {planned.length ? (
          <section aria-labelledby="gd-planned-h">
            <h2 id="gd-planned-h" className="zq-eyebrow">
              {s.plannedHeading}
            </h2>
            <p className="zq-meta">{s.plannedNote}</p>
            <ul className="gd-grid gd-grid-planned" data-testid="planned-topics">
              {planned.map((t) => (
                <TopicCard
                  key={t.slug}
                  href={`/guidance/${t.slug}`}
                  icon={t.icon_key}
                  title={ar ? t.title_ar : t.title_en}
                  alt={ar ? t.title_en : t.title_ar}
                  altLang={ar ? "en" : "ar"}
                  tag={<span className="zq-soon">{s.inPreparation}</span>}
                />
              ))}
            </ul>
          </section>
        ) : null}
        <MuftiLink s={s} />
      </div>
    </ReadingPage>
  );
}
