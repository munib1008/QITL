import type { Metadata } from "next";
import { getJourney } from "@/content/journey";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { ProphetList, type ListEra } from "@/components/pages/ProphetList";
import { DraftBadge, EraTag, EvidenceLabel } from "@/components/ui/evidence";
import { eraText } from "@/lib/i18n/modules/eras";
import { hudStrings } from "@/lib/i18n/modules/hud";
import { prophetStrings } from "@/lib/i18n/modules/prophets";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = prophetStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

export default async function ProphetsIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = prophetStrings(locale);
  const h = hudStrings(locale).list;
  const j = getJourney();
  const eras: ListEra[] = j.eras
    .map((era) => {
      const et = eraText(locale, era.title);
      return {
        title: et.text,
        note: era.note,
        english: et.english,
        stops: era.items
          .filter((s) => s.type === "prophet")
          .map((p) => {
            const first = p.surahs?.[0]?.passages[0];
            return {
              id: p.id,
              chapter: p.chapter,
              name: p.name,
              arabic: p.arabicName,
              honorific: p.honorific,
              subtitle: p.subtitle,
              eraLabel: p.era.label,
              eraTag: <EraTag {...p.era} />,
              cite: first ? `Q ${first}` : undefined,
              disputed: p.order?.disputed ? <EvidenceLabel kind="disputed">{p.order.label}</EvidenceLabel> : null,
              haystack: [p.name, p.arabicName, p.subtitle, era.title, p.era.label, ...(p.surahs ?? []).map((x) => x.name)].join(" ").toLowerCase(),
            };
          }),
      };
    })
    .filter((e) => e.stops.length);
  return (
    <ReadingPage locale={locale} crumbs={[{ label: t.title }]} kicker={<DraftBadge status={j.status} />} title={t.indexTitle} lead={t.lead}>
      <ProphetList eras={eras} s={{ ...h }} />
    </ReadingPage>
  );
}
