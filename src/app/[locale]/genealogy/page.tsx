import type { Metadata } from "next";
import Link from "next/link";
import { findStop, journeyStops } from "@/content/journey";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState, GenealogyLink } from "@/components/ui/misc";
import { getServerSupabase } from "@/lib/supabase/server";
import { GenealogyExplorer } from "@/components/genealogy/GenealogyExplorer";
import type { GenealogyGraph } from "@/components/genealogy/types";
import { englishContent } from "@/lib/i18n/locales";
import { genealogyStrings } from "@/lib/i18n/modules/atlas";
import { e2eFixturesEnabled, fixtureGraph } from "@/lib/e2e-fixtures";
import { ayahHash } from "@/lib/refs";
import { LineagePage, lineageMetadata, ViewSwitch } from "@/components/lineage/LineagePage";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ view?: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if ((await searchParams).view === "lineage") return lineageMetadata(locale);
  const t = genealogyStrings(locale);
  return { title: t.title, description: t.metaDescription };
}


export default async function GenealogyPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ focus?: string; view?: string; classes?: string; empty?: string }> }) {
  const { locale } = await params;
  const { focus = "ibrahim", view, classes, empty } = await searchParams;
  // "Lineage: Adam to Muhammad" is a second view of the same section, chosen by the URL (?view=lineage).
  if (view === "lineage") return <LineagePage locale={locale} params={{ classes, empty }} />;
  const t = genealogyStrings(locale);
  const en = englishContent(locale);
  const sb = await getServerSupabase();
  const fixture = !sb && e2eFixturesEnabled();
  const graph = sb ? ((await sb.rpc("person_graph", { person_slug: focus, depth: 2 })).data as GenealogyGraph | null) : fixture ? fixtureGraph(focus) : null;
  const centre = graph?.focus ?? focus;
  const name = (slug: string) => graph?.nodes.find((n) => n.id === slug)?.name ?? slug;
  const stops = journeyStops().filter((s) => s.type === "prophet");

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: t.title }]}
      title={t.title}
      lead={t.lead}
    >
      <div className="zq-pagebody">
        <ViewSwitch locale={locale} active="graph" />
        <form method="get" className="zq-form" aria-label={t.choose}>
          <div className="zq-field">
            <label htmlFor="focus">{t.centre}</label>
            <select id="focus" name="focus" className="zq-input" defaultValue={focus} {...en}>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button type="submit" className="zq-btn zq-btn-secondary">
              {t.show}
            </button>
          </div>
        </form>

        <section className="pp-card" aria-label={t.edgeStyles}>
          <h3>{t.howToRead}</h3>
          <GenealogyLink from={{ name: t.personA }} to={{ name: t.personB }} status="verified" />
          <GenealogyLink from={{ name: t.personA }} to={{ name: t.personB }} status="disputed" />
          <GenealogyLink from={{ name: t.personA }} to={{ name: t.unknown, unknown: true }} status="unknown" />
          <p className="zq-meta" style={{ margin: 0 }}>
            {t.illustration}
          </p>
        </section>

        {graph && graph.edges.length ? (
          <section aria-labelledby="g-h">
            <h2 id="g-h" className="zq-eyebrow">
              {t.around(name(centre))}
            </h2>
            {fixture ? <p className="zg-fixture">{t.fixture}</p> : null}
            <GenealogyExplorer graph={{ ...graph, focus: centre }} centerable={stops.map((s) => s.id)} rtl={locale !== "en"} />
            <h3 className="zq-eyebrow" style={{ marginTop: 24 }}>
              {t.list}
            </h3>
            {/* The list is the text alternative of the graph and its keyboard path. */}
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 16 }}>
              {graph.edges.map((e) => (
                <li key={e.id} className="pp-card">
                  <GenealogyLink
                    from={{ name: name(e.from), href: findStop(e.from) ? `/genealogy?focus=${e.from}` : undefined, current: e.from === centre }}
                    to={{ name: name(e.to), href: findStop(e.to) ? `/genealogy?focus=${e.to}` : undefined, current: e.to === centre }}
                    relation={t.rel[e.kind as keyof typeof t.rel] ?? e.kind}
                    status={e.confidence === "disputed" ? "disputed" : e.confidence === "unknown" ? "unknown" : "verified"}
                    evidence={
                      <>
                        <EvidenceLabel kind={e.claim.evidence} />
                        {e.claim.references.map((r, i) =>
                          r.kind === "quran" && r.surah ? (
                            <CitationChip key={i} href={`/quran/${r.surah}${ayahHash(r.from ?? 1, r.to)}`}>{`Q ${r.surah}:${r.from}${r.to && r.to !== r.from ? `–${r.to}` : ""}`}</CitationChip>
                          ) : (
                            <CitationChip key={i}>{r.locator ?? r.kind}</CitationChip>
                          ),
                        )}
                      </>
                    }
                  />
                  <p className="zq-meta" style={{ margin: "8px 0 0" }}>
                    <span {...en}>{e.claim.statement}</span>
                    {e.competingGroup ? ` · ${t.competing}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <EmptyState label={<EvidenceLabel kind="unknown">{t.noLinks}</EvidenceLabel>} title={sb ? t.noLinksTitle : t.notConnected}>
            <p>
              {t.emptyBody} <Link href={`/prophets/${focus}`}>{findStop(focus)?.item.name ?? t.theProphet}</Link>.
            </p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
