import type { Metadata } from "next";
import { getJourney } from "@/content/journey";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { ProphetCard } from "@/components/ui/cards";
import { DraftBadge, EraTag } from "@/components/ui/evidence";

export const metadata: Metadata = { title: "Prophets", description: "The prophets named in the Quran, in the order of the journey, with the surahs that tell their stories." };

export default async function ProphetsIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const j = getJourney();
  let n = 0;
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: "Prophets" }]}
      kicker={<DraftBadge status={j.status} />}
      title="Prophets of Allah"
      lead="Every prophet named in the Quran, in the order of the journey. Where the Quran gives no order or date, the page says so."
    >
      <div className="zq-pagebody">
        {j.eras.map((era) => {
          const items = era.items.filter((s) => s.type === "prophet");
          if (!items.length) return null;
          return (
            <section key={era.title} aria-labelledby={`era-${era.title}`}>
              <p className="zq-eyebrow" id={`era-${era.title}`}>
                {era.title}
              </p>
              {era.note ? <p className="zq-meta" style={{ margin: "4px 0 12px" }}>{era.note}</p> : null}
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
                      order={p.era.certainty === "disputed" || p.order?.disputed ? undefined : `${String(n).padStart(2, "0")} on the journey`}
                      mentions={
                        <span style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          <EraTag {...p.era} />
                          {named ? <span className="zq-jc-named">Surah {named.name} is named after him</span> : null}
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
