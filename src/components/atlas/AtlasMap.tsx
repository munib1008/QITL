"use client";

import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/misc";
import { atlasStrings } from "@/lib/i18n/modules/atlas";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";

interface Props {
  tilesUrl: string;
  attribution: string;
}

/**
 * MapLibre atlas, loaded only on the client and only when a tile provider is configured.
 * Draws published geometries from /api/atlas/places: verified points, hatched approximate regions,
 * dotted hypotheses and dashed routes. Unknown places are never drawn (the page lists them instead).
 */
export function AtlasMap({ tilesUrl, attribution }: Props) {
  const locale = useLocale();
  const t = atlasStrings(locale);
  const legend = uiStrings(locale).legend;
  const el = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "no_data" | "error">("loading");

  useEffect(() => {
    let map: import("maplibre-gl").Map | undefined;
    let cancelled = false;
    (async () => {
      try {
        const [{ default: maplibregl }, res] = await Promise.all([import("maplibre-gl"), fetch("/api/atlas/places")]);
        if (cancelled || !el.current) return;
        const css = getComputedStyle(document.documentElement);
        const v = (n: string) => css.getPropertyValue(n).trim() || "#888";
        map = new maplibregl.Map({
          container: el.current,
          style: {
            version: 8,
            sources: { base: { type: "raster", tiles: [tilesUrl], tileSize: 256, attribution } },
            layers: [{ id: "base", type: "raster", source: "base", paint: { "raster-saturation": -0.7, "raster-opacity": 0.85 } }],
          },
          center: [40, 26],
          zoom: 3.2,
          attributionControl: { compact: false },
          cooperativeGestures: true,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
        const geo = res.ok ? await res.json() : null;
        map.on("load", () => {
          if (!map) return;
          if (!geo || !geo.features?.length) {
            setState("no_data");
            return;
          }
          map.addSource("places", { type: "geojson", data: geo });
          map.addLayer({ id: "regions", type: "fill", source: "places", filter: ["==", ["get", "precision"], "region"], paint: { "fill-color": v("--map-region"), "fill-opacity": 0.45 } });
          map.addLayer({ id: "regions-edge", type: "line", source: "places", filter: ["==", ["get", "precision"], "region"], paint: { "line-color": v("--slate"), "line-width": 1.5 } });
          map.addLayer({ id: "hypotheses", type: "line", source: "places", filter: ["==", ["get", "precision"], "hypothesis"], paint: { "line-color": v("--map-hypothesis"), "line-width": 2, "line-dasharray": [0.5, 2] } });
          map.addLayer({ id: "routes", type: "line", source: "places", filter: ["==", ["get", "precision"], "route"], paint: { "line-color": v("--map-route"), "line-width": 2.5, "line-dasharray": [3, 2] } });
          map.addLayer({ id: "points", type: "circle", source: "places", filter: ["==", ["get", "precision"], "point"], paint: { "circle-color": v("--map-point"), "circle-radius": 6, "circle-stroke-color": v("--surface-raised"), "circle-stroke-width": 2 } });
          for (const layer of ["regions", "hypotheses", "routes", "points"])
            map.on("click", layer, (e) => {
              const f = e.features?.[0];
              if (!f || !map) return;
              const p = f.properties as { name: string; precision: string; source?: string; slug: string };
              const box = document.createElement("div");
              const h = document.createElement("b");
              h.textContent = p.name;
              const m = document.createElement("p");
              m.textContent = `${p.precision === "point" ? legend.point : p.precision === "region" ? legend.region : p.precision === "hypothesis" ? legend.hypothesis : legend.route}${p.source ? ` · ${t.source}: ${p.source}` : ""}`;
              box.append(h, m);
              new maplibregl.Popup({ closeButton: true }).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
            });
          setState("ready");
        });
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the popup words follow the page's language, fixed per page
  }, [tilesUrl, attribution]);

  return (
    <div className="zq-atlas">
      <div ref={el} className="zq-atlas-canvas" role="region" aria-label={t.mapRegion} />
      {state === "no_data" ? (
        <div className="zq-atlas-overlay">
          <EmptyState title={t.noPlaces}>
            <p>{t.noPlacesBody}</p>
          </EmptyState>
        </div>
      ) : null}
      {state === "error" ? (
        <div className="zq-atlas-overlay">
          <EmptyState title={t.mapError}>
            <p>{t.mapErrorBody}</p>
          </EmptyState>
        </div>
      ) : null}
    </div>
  );
}
