import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { ShifaHero } from "@/components/shifa/Hero";
import { LayerLegend, ReferencePoints, SafetyFraming } from "@/components/shifa/Shifa";
import { publishedTopics } from "@/lib/data/shifa";
import { getDict } from "@/lib/i18n";
import { shifaStrings } from "@/lib/i18n/modules/shifa";
import { PLANNED_TOPICS, SECTIONS } from "@/lib/shifa/model";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = shifaStrings((await params).locale);
  return { title: s.title, description: s.lead };
}

export default async function ShifaHub({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const s = shifaStrings(locale);
  const topics = await publishedTopics();
  const titles = Object.fromEntries(PLANNED_TOPICS.map((t) => [t.slug, locale === "ar" ? t.title_ar : t.title_en]));
  return (
    <ReadingPage locale={raw} crumbs={[{ label: s.nav }]} kicker={s.kicker} title={s.title} lead={s.lead}>
      <div className="zq-pagebody sh-page">
        <ShifaHero labels={s.hero} />
        <SafetyFraming s={s} locale={locale} />
        <section aria-labelledby="sh-sections-h">
          <h2 id="sh-sections-h" className="zq-eyebrow">
            {s.sectionsHeading}
          </h2>
          <ul className="sh-sections" data-testid="shifa-sections">
            {SECTIONS.map((sec) => (
              <li key={sec.key}>
                <Link href={`/shifa/${sec.slug}`} className="sh-section-card" data-section={sec.key}>
                  <b>{s.sections[sec.key].title}</b>
                  <span>{s.sections[sec.key].note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {topics?.length ? null : (
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.structureOnly}</EvidenceLabel>} title={topics ? s.emptyTitle : s.emptyNotConnected}>
            <p>{s.structureOnlyBody}</p>
            <p>{s.emptyBody}</p>
          </EmptyState>
        )}
        <LayerLegend s={s} />
        <ReferencePoints s={s} titles={titles} />
      </div>
    </ReadingPage>
  );
}
