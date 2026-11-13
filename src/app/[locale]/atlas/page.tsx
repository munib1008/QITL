import type { Metadata } from "next";
import Link from "next/link";
import { getJourney, journeyStops, type PlaceCertainty } from "@/content/journey";
import { englishContent } from "@/lib/i18n/locales";
import { hudStrings } from "@/lib/i18n/modules/hud";
import { atlasStrings } from "@/lib/i18n/modules/atlas";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { DraftBadge } from "@/components/ui/evidence";
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
        <div className="qs">
          <div className="legend" style={{ marginBottom: "var(--space-5)" }}>
            {ORDER.map((c) => (
              <span key={c} className={`place ${c}`}>
                <i aria-hidden="true" />
                {PLACE_TEXT[c]}
              </span>
            ))}
          </div>
          <div className="board" data-testid="places-board">
            {ORDER.map((c) => {
              const items = stops.filter((s) => (s.place?.certainty ?? "unknown") === c);
              return (
                <section key={c} className="col" aria-label={PLACE_TEXT[c]}>
                  <h3>
                    {PLACE_TEXT[c]} <small>{items.length}</small>
                  </h3>
                  {items.length ? (
                    items.map((s) => (
                      <Link key={s.id} className="pl" href={`/prophets/${s.id}#places`} aria-current={focus === s.id || undefined} {...en}>
                        <b>{s.name}</b>
                        <small>{s.place?.name ?? t.locationUnknown}</small>
                      </Link>
                    ))
                  ) : (
                    <small style={{ color: "var(--q-text-3)" }}>{hudStrings(locale).list.empty}</small>
                  )}
                </section>
              );
            })}
          </div>
          <p className="callout" style={{ marginTop: "var(--space-5)" }}>
            <span>{t.placesNote}</span>
          </p>
        </div>
        <section aria-label={t.map} className="zx-map-col" style={{ marginTop: "var(--space-7)" }}>
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
    </ReadingPage>
  );
}
