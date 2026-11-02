import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { AiDraftBanner, Section, Unavailable } from "@/components/asma/Parts";
import { DuaComposer } from "@/components/asma/DuaComposer";
import { asmaDuas } from "@/lib/data/asma";
import { getDict } from "@/lib/i18n";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import { titleOf } from "@/lib/asma/model";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = asmaStrings((await params).locale);
  return { title: s.dua.title, description: s.dua.lead };
}

export default async function CallUpon({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const s = asmaStrings(locale);
  const d = s.dua;
  const duas = await asmaDuas();
  return (
    <ReadingPage locale={raw} crumbs={[{ href: "/asma", label: s.nav }, { label: d.title }]} kicker={s.kicker} title={d.title} lead={d.lead}>
      <div className="zq-pagebody as-page">
        <section className="as-section" aria-labelledby="as-dg-h">
          <h2 id="as-dg-h">{d.guidanceHeading}</h2>
          <ul className="as-list" data-testid="dua-guidance">
            {d.guidance.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
        <Section id="as-dl" title={d.listHeading}>
          {duas === null ? (
            <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.notConnected.title}</EvidenceLabel>} title={s.notConnected.title}>
              <p>{s.notConnected.body}</p>
            </EmptyState>
          ) : duas.length === 0 ? (
            <Unavailable locale={locale}>{d.noneListed}</Unavailable>
          ) : (
            <>
              {duas.some((x) => !x.published) ? <AiDraftBanner locale={locale} /> : null}
              <ul className="as-list" data-testid="dua-list">
                {duas.map((x) => (
                  <li key={x.slug}>
                    <Link href={`/asma/dua/${x.slug}`}>{titleOf(x, locale) || x.slug}</Link>
                    <span className="zq-meta">{x.category === "A" ? d.categoryA : d.categoryB}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
        <Section id="as-de" title={d.etiquetteHeading}>
          <Unavailable locale={locale}>{d.etiquetteBody}</Unavailable>
        </Section>
        <DuaComposer locale={locale} />
      </div>
    </ReadingPage>
  );
}
