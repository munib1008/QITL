import type { Metadata } from "next";
import { getJourney } from "@/content/journey";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { ProphetCard } from "@/components/ui/cards";
import { DraftBadge, EraTag } from "@/components/ui/evidence";
import { englishContent } from "@/lib/i18n/locales";
import { prophetStrings } from "@/lib/i18n/modules/prophets";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = prophetStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

export default async function ProphetsIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = prophetStrings(locale);
  const en = englishContent(locale);
  const j = getJourney();
  let n = 0;
  return (
    <ReadingPage locale={locale} crumbs={[{ label: t.title }]} kicker={<DraftBadge status={j.status} />} title={t.indexTitle} lead={t.lead}>
      <div className="zq-pagebody">
        {j.eras.map((era) => {
          const items = era.items.filter((s) => s.type === "prophet");
          if (!items.length) return null;
          return (
            <section key={era.title} aria-labelledby={`era-${era.title}`}>
              <p className="zq-eyebrow" id={`era-${era.title}`} {...en}>
                {era.title}
              </p>
              {era.note ? (
                <p className="zq-meta" style={{ margin: "4px 0 12px" }} {...en}>
                  {era.note}
                </p>
              ) : null}
              <div className="zq-grid">
                {items.map((p) => {
                  n++;
                  const named = p.surahs?.find((s) => s.named);
                  return (
                    <ProphetCard
                      key={p.id}
                      href={`/prophets/${p.id}`}
                      name={p.name}
                      arabicName={p.arabicName}
                      honorific={p.honorific}
                      order={p.era.certainty === "disputed" || p.order?.disputed ? undefined : t.onJourney(String(n).padStart(2, "0"))}
                      mentions={
                        <span style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          <EraTag {...p.era} />
                          {named ? <span className="zq-jc-named">{t.namedAfter(named.name)}</span> : null}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </ReadingPage>
  );
}
