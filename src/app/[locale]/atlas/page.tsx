import type { Metadata } from "next";
import Link from "next/link";
import { getJourney, journeyStops, type PlaceCertainty } from "@/content/journey";
import { englishContent } from "@/lib/i18n/locales";
import { atlasStrings } from "@/lib/i18n/modules/atlas";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { DraftBadge, EvidenceLabel } from "@/components/ui/evidence";
import { MapLegend } from "@/components/ui/misc";
import { AtlasMapLoader } from "@/components/atlas/AtlasMapLoader";
import { AtlasSchematic, type AtlasStop } from "@/components/atlas/AtlasSchematic";
import { ResponsiveDetails } from "@/components/ui/ResponsiveDetails";
import { mapConfigured, publicEnv } from "@/lib/env";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = atlasStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

const ORDER: PlaceCertainty[] = ["point", "region", "hypothesis", "disputed", "unknown"];
const KIND = { point: "scholar", region: "estimate", hypothesis: "estimate", disputed: "disputed", unknown: "unknown" } as const;

export default async function AtlasPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ focus?: string }> }) {
  const { locale } = await params;
  const { focus } = await searchParams;
  const t = atlasStrings(locale);
  const PLACE_TEXT = uiStrings(locale).place;
  const en = englishContent(locale);
  const j = getJourney();
  const stops = journeyStops(j);
  const focusStop = focus ? stops.find((s) => s.id === focus) : undefined;
  const schematic: AtlasStop[] = j.eras.flatMap((e) =>
    e.items.map((s) => ({ id: s.id, name: s.name, era: e.title, place: s.place?.name ?? t.locationUnknown, certainty: s.place?.certainty ?? "unknown" })),
  );
  const groups = ORDER.map((c) => ({ c, items: stops.filter((s) => (s.place?.certainty ?? "unknown") === c) })).filter((g) => g.items.length);

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: t.title }]}
      kicker={<DraftBadge status={j.status} />}
      title={t.title}
      lead={t.lead}
    >
      <div className="zq-pagebody">
        {focusStop ? (
          <p className="zx-return">
            <Link className="zq-btn zq-btn-secondary" href={`/prophets/${focusStop.id}#places`}>
              <span aria-hidden="true" className="zx-back">
                ←
              </span>{" "}
              {t.returnTo(focusStop.name)}
            </Link>
          </p>
        ) : null}
        <div className="zq-split" style={{ gridTemplateColumns: undefined }}>
          <section aria-labelledby="places-h" className="zq-split-sticky">
            <h2 id="places-h" className="zq-eyebrow">
              {t.placesHeading}
            </h2>
            <p className="zq-meta">{t.placesNote}</p>
            {groups.map((g) => (
              <div key={g.c} style={{ marginTop: 16 }}>
                <EvidenceLabel kind={KIND[g.c]}>{PLACE_TEXT[g.c]}</EvidenceLabel>
                <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }} {...en}>
                  {g.items.map((s) => (
                    <li key={s.id} className="zq-result" style={{ padding: "8px 0" }} aria-current={focus === s.id || undefined}>
                      <Link href={`/prophets/${s.id}#places`} style={{ color: "var(--ink)", fontWeight: focus === s.id ? 700 : 600 }}>
                        {s.name}
                      </Link>
                      <span className="zq-meta">{s.place?.name ?? t.locationUnknown}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
          <section aria-label={t.map} className="zx-map-col">
            {mapConfigured() ? (
              <AtlasMapLoader tilesUrl={publicEnv.mapTilesUrl} attribution={publicEnv.mapAttribution} />
            ) : (
              <>
                <p className="zq-meta">{t.noMap}</p>
                <AtlasSchematic stops={schematic} focus={focus} rtl={locale !== "en"} />
              </>
            )}
            <ResponsiveDetails className="zx-legend" summary={t.legend}>
              <MapLegend
                items={mapConfigured() ? ["point", "region", "unknown", "hypothesis", "route"] : ["point", "region", "hypothesis", "unknown"]}
                attribution={mapConfigured() ? publicEnv.mapAttribution : t.schematicAttribution}
              />
            </ResponsiveDetails>
          </section>
        </div>
      </div>
    </ReadingPage>
  );
}
