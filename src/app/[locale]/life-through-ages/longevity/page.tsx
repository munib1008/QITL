import type { Metadata } from "next";
import { BASE, LtaShell, NoRecords, okData } from "@/components/lifestyle/Shell";
import { RecordMeta, ReconstructionContainer } from "@/components/lifestyle/Evidence";
import { LifespanLanes } from "@/components/lifestyle/LifespanLanes";
import { NuhNote } from "@/components/lifestyle/NuhNote";
import { lifestyleStrings } from "@/lib/i18n/modules/lifestyle";
import { getLifespanClaims } from "@/lib/lifestyle/data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const l = (await params).locale;
  const t = lifestyleStrings(l);
  return { title: `${t.sections.longevity} · ${t.title}`, alternates: { canonical: `${BASE}/longevity` } };
}
export const revalidate = 300;

/**
 * Explains lifespan vs life expectancy (at birth, after childhood) vs maximum verified lifespan. The only numbers on
 * the page are those of published records, each in its own lane; speculative theories are class D, kept apart.
 */
export default async function LongevityCenter({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = lifestyleStrings(locale);
  const res = await getLifespanClaims();
  const records = okData(res);
  const theories = records.filter((r) => r.kind === "speculative_theory");
  return (
    <LtaShell locale={locale} section="longevity" title={t.sections.longevity} lead={t.sections.longevityNote}>
      <section className="lta-section" aria-labelledby="lta-terms-h">
        <h2 id="lta-terms-h">{t.longevity.termsTitle}</h2>
        <p>{t.longevity.intro}</p>
        <dl className="lta-terms">
          {t.longevity.terms.map(([term, def]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <NuhNote t={t} />

      <section className="lta-section" aria-label={t.longevity.chartTitle}>
        {res.state !== "ok" ? <NoRecords t={t} result={res} /> : null}
        <LifespanLanes records={records} t={t} />
      </section>

      <section className="lta-section" aria-labelledby="lta-spec-h">
        <h2 id="lta-spec-h">{t.longevity.speculative}</h2>
        <ReconstructionContainer t={t}>
          <p>{t.longevity.speculativeNote}</p>
          {theories.map((r) => (
            <div key={r.id}>
              {r.statement ? <p>{r.statement}</p> : null}
              <RecordMeta r={r} t={t} />
            </div>
          ))}
        </ReconstructionContainer>
      </section>
    </LtaShell>
  );
}
