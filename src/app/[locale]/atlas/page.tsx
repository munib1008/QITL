import type { Metadata } from "next";
import Link from "next/link";
import { PLACE_TEXT, getJourney, journeyStops, type PlaceCertainty } from "@/content/journey";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { DraftBadge, EvidenceLabel } from "@/components/ui/evidence";
import { MapLegend } from "@/components/ui/misc";
import { AtlasMapLoader } from "@/components/atlas/AtlasMapLoader";
import { AtlasSchematic, type AtlasStop } from "@/components/atlas/AtlasSchematic";
import { ResponsiveDetails } from "@/components/ui/ResponsiveDetails";
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
  const focusStop = focus ? stops.find((s) => s.id === focus) : undefined;
  const schematic: AtlasStop[] = j.eras.flatMap((e) =>
    e.items.map((s) => ({ id: s.id, name: s.name, era: e.title, place: s.place?.name ?? "Location unknown", certainty: s.place?.certainty ?? "unknown" })),
  );
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
        {focusStop ? (
          <p className="zx-return">
            <Link className="zq-btn zq-btn-secondary" href={`/prophets/${focusStop.id}#places`}>
              <span aria-hidden="true" className="zx-back">
                ←
              </span>{" "}
              Return to the story of {focusStop.name}
            </Link>
          </p>
        ) : null}
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
          <section aria-label="Map" className="zx-map-col">
            {mapConfigured() ? (
              <AtlasMapLoader tilesUrl={publicEnv.mapTilesUrl} attribution={publicEnv.mapAttribution} />
            ) : (
              <>
                <p className="zq-meta">The geographic map needs a tile provider and reviewed place geometries; neither is configured on this site, so this schematic is shown instead of an invented map.</p>
                <AtlasSchematic stops={schematic} focus={focus} rtl={locale === "ar"} />
              </>
            )}
            <ResponsiveDetails className="zx-legend" summary="Legend">
              <MapLegend
                items={mapConfigured() ? ["point", "region", "unknown", "hypothesis", "route"] : ["point", "region", "hypothesis", "unknown"]}
                attribution={mapConfigured() ? publicEnv.mapAttribution : "Schematic drawing by QITL · no map data"}
              />
            </ResponsiveDetails>
          </section>
        </div>
      </div>
    </ReadingPage>
  );
}
