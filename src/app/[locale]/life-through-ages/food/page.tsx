import type { Metadata } from "next";
import { BASE, LtaShell, NoRecords, okData } from "@/components/lifestyle/Shell";
import { RecordMeta, ReconstructionContainer } from "@/components/lifestyle/Evidence";
import { Scene } from "@/components/lifestyle/Scene";
import { Markdown } from "@/components/ui/Markdown";
import { lifestyleStrings } from "@/lib/i18n/modules/lifestyle";
import { getFoods } from "@/lib/lifestyle/data";
import { splitReconstructions } from "@/lib/lifestyle/model";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const l = (await params).locale;
  const t = lifestyleStrings(l);
  return { title: `${t.sections.food} · ${t.title}`, alternates: { canonical: `${BASE}/food` } };
}
export const revalidate = 300;

/** Foods and where each mention comes from. The caution is fixed and always shown, records or not. */
export default async function FoodExplorer({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = lifestyleStrings(locale);
  const res = await getFoods();
  const foods = okData(res);
  return (
    <LtaShell locale={locale} section="food" title={t.sections.food} lead={t.sections.foodNote}>
      <p className="lta-notice lta-caution" data-testid="food-caution" role="note">
        {t.food.caution}
      </p>
      {!foods.length ? (
        <NoRecords t={t} result={res} />
      ) : (
        <div className="lta-grid" data-testid="food-list">
          {foods.map((f) => {
            const { established, reconstructions } = splitReconstructions(f.links);
            return (
              <article key={f.id} className="pp-card lta-card" data-food={f.slug}>
                <h3 className="lta-card-title">
                  {f.name_en}
                  {f.name_ar ? (
                    <span lang="ar" dir="rtl">
                      {" "}
                      · {f.name_ar}
                    </span>
                  ) : null}
                </h3>
                {f.summary ? <Markdown source={f.summary} /> : null}
                <RecordMeta r={f} t={t} />
                {established.length ? (
                  <div>
                    <b>{t.food.mentions}</b>
                    {established.map((l) => (
                      <div key={l.id} data-link-kind={l.link_kind}>
                        {l.statement ? <Markdown source={l.statement} /> : null}
                        <RecordMeta r={l} t={t} />
                      </div>
                    ))}
                  </div>
                ) : null}
                {reconstructions.map((l) => (
                  <ReconstructionContainer key={l.id} t={t}>
                    {l.statement ? <Markdown source={l.statement} /> : null}
                    <RecordMeta r={l} t={t} />
                  </ReconstructionContainer>
                ))}
              </article>
            );
          })}
        </div>
      )}
      <div className="lta-scenes">
        <Scene scene="harvest" labels={t.illustration} />
        <Scene scene="palms" labels={t.illustration} />
        <Scene scene="well" labels={t.illustration} />
      </div>
    </LtaShell>
  );
}
