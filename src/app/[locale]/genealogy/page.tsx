import type { Metadata } from "next";
import Link from "next/link";
import { findStop, journeyStops } from "@/content/journey";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState, GenealogyLink } from "@/components/ui/misc";
import { getServerSupabase } from "@/lib/supabase/server";
import { GenealogyExplorer } from "@/components/genealogy/GenealogyExplorer";
import { REL, type GenealogyGraph } from "@/components/genealogy/types";
import { e2eFixturesEnabled, fixtureGraph } from "@/lib/e2e-fixtures";

export const metadata: Metadata = {
  title: "Genealogy",
  description: "Family relationships between the prophets and the Prophet's household, each edge resting on a cited, reviewed claim.",
};


export default async function GenealogyPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ focus?: string }> }) {
  const { locale } = await params;
  const { focus = "ibrahim" } = await searchParams;
  const sb = await getServerSupabase();
  const fixture = !sb && e2eFixturesEnabled();
  const graph = sb ? ((await sb.rpc("person_graph", { person_slug: focus, depth: 2 })).data as GenealogyGraph | null) : fixture ? fixtureGraph(focus) : null;
  const centre = graph?.focus ?? focus;
  const name = (slug: string) => graph?.nodes.find((n) => n.id === slug)?.name ?? slug;
  const stops = journeyStops().filter((s) => s.type === "prophet");

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: "Genealogy" }]}
      title="Genealogy"
      lead="Every family link rests on a cited claim that a scholar reviewed. Solid lines are sourced, double lines are disputed, dotted lines are unknown. No generation is invented, and no “last descendant” is named."
    >
      <div className="zq-pagebody">
        <form method="get" className="zq-form" aria-label="Choose a person">
          <div className="zq-field">
            <label htmlFor="focus">Centre the graph on</label>
            <select id="focus" name="focus" className="zq-input" defaultValue={focus}>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button type="submit" className="zq-btn zq-btn-secondary">
              Show
            </button>
          </div>
        </form>

        <section className="pp-card" aria-label="Edge styles">
          <h3>How to read the lines</h3>
          <GenealogyLink from={{ name: "Person A" }} to={{ name: "Person B" }} status="verified" />
          <GenealogyLink from={{ name: "Person A" }} to={{ name: "Person B" }} status="disputed" />
          <GenealogyLink from={{ name: "Person A" }} to={{ name: "Unknown", unknown: true }} status="unknown" />
          <p className="zq-meta" style={{ margin: 0 }}>Illustration of the line styles only; these are not real relationships.</p>
        </section>

        {graph && graph.edges.length ? (
          <section aria-labelledby="g-h">
            <h2 id="g-h" className="zq-eyebrow">
              Around {name(centre)}
            </h2>
            {fixture ? <p className="zg-fixture">Test fixture: synthetic people and links used by the automated tests. These are not real relationships.</p> : null}
            <GenealogyExplorer graph={{ ...graph, focus: centre }} centerable={stops.map((s) => s.id)} rtl={locale === "ar"} />
            <h3 className="zq-eyebrow" style={{ marginTop: 24 }}>
              Relationship list
            </h3>
            {/* The list is the text alternative of the graph and its keyboard path. */}
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 16 }}>
              {graph.edges.map((e) => (
                <li key={e.id} className="pp-card">
                  <GenealogyLink
                    from={{ name: name(e.from), href: findStop(e.from) ? `/genealogy?focus=${e.from}` : undefined, current: e.from === centre }}
                    to={{ name: name(e.to), href: findStop(e.to) ? `/genealogy?focus=${e.to}` : undefined, current: e.to === centre }}
                    relation={REL[e.kind as keyof typeof REL] ?? e.kind}
                    status={e.confidence === "disputed" ? "disputed" : e.confidence === "unknown" ? "unknown" : "verified"}
                    evidence={
                      <>
                        <EvidenceLabel kind={e.claim.evidence} />
                        {e.claim.references.map((r, i) =>
                          r.kind === "quran" && r.surah ? (
                            <CitationChip key={i} href={`/quran/${r.surah}#ayah-${r.from}`}>{`Q ${r.surah}:${r.from}${r.to && r.to !== r.from ? `–${r.to}` : ""}`}</CitationChip>
                          ) : (
                            <CitationChip key={i}>{r.locator ?? r.kind}</CitationChip>
                          ),
                        )}
                      </>
                    }
                  />
                  <p className="zq-meta" style={{ margin: "8px 0 0" }}>
                    {e.claim.statement}
                    {e.competingGroup ? " · One of several competing lines; all are shown." : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <EmptyState label={<EvidenceLabel kind="unknown">No reviewed links yet</EvidenceLabel>} title={sb ? `No reviewed family links are published around this person yet.` : "The genealogy database is not connected on this site yet."}>
            <p>
              Family links are added by editors from cited sources and published only after a scholarly reviewer approves the claim behind each one. They are
              never derived from text automatically. Meanwhile, read each prophet&apos;s page: <Link href={`/prophets/${focus}`}>{findStop(focus)?.item.name ?? "the prophet"}</Link>.
            </p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
