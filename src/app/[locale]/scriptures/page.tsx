import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { ayahHash } from "@/lib/refs";
import { EmptyState } from "@/components/ui/misc";
import { loadWitnesses } from "@/lib/data/lineage";
import { englishContent } from "@/lib/i18n/locales";
import { scriptureStrings } from "@/lib/i18n/modules/lineage";
import { genealogyStrings } from "@/lib/i18n/modules/atlas";
import { EvidenceChip } from "@/components/lineage/EvidenceChip";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = scriptureStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

const LAYERS = ["tawrah", "zabur", "injil"] as const;

/**
 * The ancient scriptures research layer: published witnesses only, each with its mandatory limitation. A comparison
 * register, not an authentication; no scripture text is reproduced, only names, descriptions and citations.
 */
export default async function ScripturesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ empty?: string }> }) {
  const { locale } = await params;
  const { empty } = await searchParams;
  const t = scriptureStrings(locale);
  const g = genealogyStrings(locale);
  const en = englishContent(locale);
  const { witnesses, counts, source } = await loadWitnesses({ empty: empty === "1" });
  const fixture = source === "fixture";
  const label = (w: (typeof witnesses)[number]) => (locale === "ar" && w.nameAr ? { text: w.nameAr, props: {} } : locale === "ur" && w.nameUr ? { text: w.nameUr, props: {} } : { text: w.name, props: en });

  return (
    <ReadingPage locale={locale} crumbs={[{ label: g.title, href: "/genealogy" }, { label: t.nav }]} title={t.title} lead={t.lead}>
      <div className="zq-pagebody" style={{ display: "grid", gap: 24 }}>
        {fixture ? <p className="ln-fixture">{t.fixture}</p> : null}

        <section className="sc-note" aria-labelledby="sc-frame-h">
          <h2 id="sc-frame-h" className="zq-eyebrow">
            {t.frameworkTitle}
          </h2>
          <p>
            {t.framework} <Link href={`/quran/5${ayahHash(48)}`}>{t.framework548}</Link>
          </p>
          <p>{t.noOriginal}</p>
        </section>

        {source === "none" ? (
          <EmptyState title={g.notConnected} />
        ) : witnesses.length === 0 ? (
          <>
            <EmptyState title={t.emptyTitle}>
              <p>{t.emptyBody}</p>
            </EmptyState>
            <section aria-labelledby="sc-counts-h">
              <h2 id="sc-counts-h" className="zq-eyebrow">
                {t.countsTitle}
              </h2>
              <p>{t.countLine(counts.published, counts.underReview)}</p>
            </section>
          </>
        ) : (
          LAYERS.map((layer) => {
            const rows = witnesses.filter((w) => w.layer === layer);
            return (
              <section key={layer} className="sc-layer" aria-labelledby={`sc-${layer}`} data-layer={layer}>
                <h2 id={`sc-${layer}`}>{t.layers[layer].name}</h2>
                <p className="zq-meta" style={{ margin: 0 }}>
                  {t.layers[layer].intro}
                </p>
                {rows.length ? (
                  <ul className="sc-list">
                    {rows.map((w) => {
                      const n = label(w);
                      return (
                        <li key={w.id} className="sc-card" id={w.slug}>
                          <h3 {...n.props}>{n.text}</h3>
                          <p className="zq-meta" style={{ margin: 0 }}>
                            {t.kinds[w.kind]}
                          </p>
                          <dl>
                            <dt>{t.language}</dt>
                            <dd {...en}>{w.language}</dd>
                            <dt>{t.dating}</dt>
                            <dd {...(w.dating ? en : {})}>{w.dating ?? t.notEstablished}</dd>
                            <dt>{t.whatItIs}</dt>
                            <dd {...en}>{w.whatItIs}</dd>
                          </dl>
                          <div className="sc-limit">
                            <b>{t.limitation}</b>
                            <p style={{ margin: "4px 0 0" }} {...en}>
                              {w.limitation}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p>{t.layerEmpty}</p>
                )}
              </section>
            );
          })
        )}

        <section className="sc-note" aria-labelledby="sc-cite-h">
          <h2 id="sc-cite-h" className="zq-eyebrow">
            {t.citeTitle}
          </h2>
          <p>
            <EvidenceChip cls="scripture" />
          </p>
          <p>{t.citeBody}</p>
          <p>
            <Link href="/genealogy?view=lineage">{t.backToLineage}</Link>
          </p>
        </section>
      </div>
    </ReadingPage>
  );
}
