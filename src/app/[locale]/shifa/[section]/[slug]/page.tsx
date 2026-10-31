import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { EntryView, LayerLegend, SafetyFraming, TopicIcon } from "@/components/shifa/Shifa";
import { topicPage } from "@/lib/data/shifa";
import { getDict } from "@/lib/i18n";
import { shifaStrings } from "@/lib/i18n/modules/shifa";
import { plannedTopic, sectionFromSlug } from "@/lib/shifa/model";

export const revalidate = 300;

type Params = Promise<{ locale: string; section: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const s = shifaStrings(locale);
  const data = await topicPage(slug);
  const t = data?.topic ?? plannedTopic(slug);
  if (!t) return { title: s.nav };
  return { title: `${locale === "ar" && t.title_ar ? t.title_ar : t.title_en} · ${s.nav}`, description: s.safety.title };
}

export default async function ShifaTopicPage({ params }: { params: Params }) {
  const { locale: raw, section, slug } = await params;
  const key = sectionFromSlug(section);
  if (!key) notFound();
  const { locale } = getDict(raw);
  const s = shifaStrings(locale);
  const ar = locale === "ar";
  const data = await topicPage(slug);
  const topic = data?.topic ?? plannedTopic(slug);
  if (!topic || topic.section !== key) notFound();
  const entries = data?.entries ?? [];
  const title = ar && topic.title_ar ? topic.title_ar : topic.title_en;
  return (
    <ReadingPage
      locale={raw}
      crumbs={[{ href: "/shifa", label: s.nav }, { href: `/shifa/${section}`, label: s.sections[key].title }, { label: title }]}
      kicker={
        <span className="sh-kick">
          <TopicIcon icon={topic.icon_key} /> {s.sections[key].title}
        </span>
      }
      title={title}
    >
      <div className="zq-pagebody sh-page">
        <SafetyFraming s={s} section={key} notes={data?.safety} locale={locale} />
        <section aria-labelledby="sh-entries-h" className="sh-entries">
          <h2 id="sh-entries-h">{s.layersHeading}</h2>
          <p className="zq-meta">{s.layersLegend}</p>
          {entries.length ? (
            entries.map((e, i) => <EntryView key={e.id} entry={e} section={key} s={s} locale={locale} index={i + 1} notes={data?.safety} />)
          ) : (
            <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.inPreparation}</EvidenceLabel>} title={data === null ? s.emptyNotConnected : s.topicEmptyTitle}>
              <p>{s.topicEmptyBody}</p>
            </EmptyState>
          )}
        </section>
        {entries.length ? null : <LayerLegend s={s} />}
      </div>
    </ReadingPage>
  );
}
