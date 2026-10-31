import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { SafetyFraming, TopicCard } from "@/components/shifa/Shifa";
import { publishedTopics } from "@/lib/data/shifa";
import { getDict } from "@/lib/i18n";
import { shifaStrings } from "@/lib/i18n/modules/shifa";
import { plannedIn, sectionFromSlug, sectionSlug } from "@/lib/shifa/model";

export const revalidate = 300;

type Params = Promise<{ locale: string; section: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, section } = await params;
  const key = sectionFromSlug(section);
  const s = shifaStrings(locale);
  if (!key) return { title: s.nav };
  return { title: `${s.sections[key].title} · ${s.nav}`, description: s.sections[key].note };
}

export default async function ShifaSectionPage({ params }: { params: Params }) {
  const { locale: raw, section } = await params;
  const key = sectionFromSlug(section);
  if (!key) notFound();
  const { locale } = getDict(raw);
  const s = shifaStrings(locale);
  const ar = locale === "ar";
  const topics = await publishedTopics(key);
  const published = new Set((topics ?? []).map((t) => t.slug));
  const planned = plannedIn(key).filter((t) => !published.has(t.slug));
  return (
    <ReadingPage
      locale={raw}
      crumbs={[{ href: "/shifa", label: s.nav }, { label: s.sections[key].title }]}
      kicker={s.kicker}
      title={s.sections[key].title}
      lead={s.sections[key].note}
    >
      <div className="zq-pagebody sh-page">
        <SafetyFraming s={s} section={key} locale={locale} />
        {topics?.length ? (
          <section aria-labelledby="sh-topics-h">
            <h2 id="sh-topics-h" className="zq-eyebrow">
              {s.topicsHeading}
            </h2>
            <ul className="sh-grid" data-testid="topic-grid">
              {topics.map((t) => (
                <TopicCard
                  key={t.slug}
                  href={`/shifa/${sectionSlug(key)}/${t.slug}`}
                  icon={t.icon_key}
                  title={ar && t.title_ar ? t.title_ar : t.title_en}
                  alt={ar ? t.title_en : (t.title_ar ?? undefined)}
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
          <section aria-labelledby="sh-planned-h">
            <h2 id="sh-planned-h" className="zq-eyebrow">
              {s.plannedHeading}
            </h2>
            <p className="zq-meta">{s.plannedNote}</p>
            <ul className="sh-grid sh-grid-planned" data-testid="planned-topics">
              {planned.map((t) => (
                <TopicCard
                  key={t.slug}
                  href={`/shifa/${sectionSlug(key)}/${t.slug}`}
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
      </div>
    </ReadingPage>
  );
}
