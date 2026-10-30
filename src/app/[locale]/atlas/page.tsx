import type { Metadata } from "next";
import Link from "next/link";
import { PLACE_TEXT, getJourney, journeyStops, type PlaceCertainty } from "@/content/journey";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { DraftBadge, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState, MapLegend } from "@/components/ui/misc";
import { AtlasMapLoader } from "@/components/atlas/AtlasMapLoader";
import { mapConfigured, publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Atlas",
  description: "Documented places, approximate regions and openly unknown locations. No coordinate is invented.",
};

const ORDER: PlaceCertainty[] = ["point", "region", "hypothesis", "disputed", "unknown"];
const KIND = { point: "scholar", region: "estimate", hypothesis: "estimate", disputed: "disputed", unknown: "unknown" } as const;

export default async function AtlasPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ focus?: string }> }) {
  const { locale } = await params;
  const { focus } = await searchParams;
  const j = getJourney();
  const stops = journeyStops(j);
  const groups = ORDER.map((c) => ({ c, items: stops.filter((s) => (s.place?.certainty ?? "unknown") === c) })).filter((g) => g.items.length);

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: "Atlas" }]}
      kicker={<DraftBadge status={j.status} />}
      title="Atlas"
      lead="Verified points only where a source supports them; approximate regions are shaded; unknown places are listed, never placed."
    >
      <div className="zq-pagebody">
        <div className="zq-split" style={{ gridTemplateColumns: undefined }}>
          <section aria-labelledby="places-h" className="zq-split-sticky">
            <h2 id="places-h" className="zq-eyebrow">
              Places on the journey, by certainty
            </h2>
            <p className="zq-meta">This list is the text version of the map. It is drawn from the journey content, which is still in scholarly review.</p>
            {groups.map((g) => (
              <div key={g.c} style={{ marginTop: 16 }}>
                <EvidenceLabel kind={KIND[g.c]}>{PLACE_TEXT[g.c]}</EvidenceLabel>
                <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
                  {g.items.map((s) => (
                    <li key={s.id} className="zq-result" style={{ padding: "8px 0" }} aria-current={focus === s.id || undefined}>
                      <Link href={`/prophets/${s.id}#places`} style={{ color: "var(--ink)", fontWeight: focus === s.id ? 700 : 600 }}>
                        {s.name}
                      </Link>
                      <span className="zq-meta">{s.place?.name ?? "Location unknown"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
          <section aria-label="Map">
            {mapConfigured() ? (
              <AtlasMapLoader tilesUrl={publicEnv.mapTilesUrl} attribution={publicEnv.mapAttribution} />
            ) : (
              <EmptyState tone="soon" label={<span className="zq-soon">Coming soon</span>} title="The interactive map is not connected yet.">
                <p>
                  The map needs a tile provider and reviewed place geometries. Neither is configured on this site, so no map is shown rather than an
                  invented one. The list of places works now.
                </p>
              </EmptyState>
            )}
            <div style={{ marginTop: 16 }}>
              <MapLegend items={["point", "region", "unknown", "hypothesis", "route"]} attribution={publicEnv.mapAttribution || "No map data provider configured"} />
            </div>
          </section>
        </div>
      </div>
    </ReadingPage>
  );
}
