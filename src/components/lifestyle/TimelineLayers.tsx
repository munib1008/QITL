import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/lifestyle.css";
import { EmptyState } from "@/components/ui/misc";
import { lifestyleStrings } from "@/lib/i18n/modules/lifestyle";
import { getEras, getLayerRecords, type TopicRecord } from "@/lib/lifestyle/data";
import { isLayer, LAYERS, type Layer } from "@/lib/lifestyle/model";
import { RecordCard } from "./Evidence";
import { Scene } from "./Scene";

const SCENE: Record<Exclude<Layer, "prophets">, string> = {
  lifestyle: "pastoral",
  food: "harvest",
  housing: "mud-brick",
  trade: "trade-route",
  transport: "ship",
  health: "well",
  lifespan: "fields",
};

/**
 * The timeline's layer switch. "Prophets & events" is the existing timeline (children). Every other layer lists
 * published Life Through the Ages records grouped by era in relative order: no record is placed by a date through
 * a prophet, and the early prophets are never dated. A layer with no published records shows its designed empty state.
 */
export async function TimelineLayers({ locale, layer, children }: { locale: string; layer?: string; children: ReactNode }) {
  const t = lifestyleStrings(locale);
  const current: Layer = isLayer(layer) ? layer : "prophets";
  return (
    <div data-testid="timeline-layers" data-layer={current}>
      <nav aria-label={t.layers.label} style={{ marginBottom: 16 }}>
        <ul className="lta-layers">
          {LAYERS.map((l) => (
            <li key={l}>
              <Link href={l === "prophets" ? "/timeline" : `/timeline?layer=${l}`} aria-current={l === current ? "true" : undefined} scroll={false}>
                {t.layers[l]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {current === "prophets" ? children : <LayerPanel locale={locale} layer={current} />}
    </div>
  );
}

async function LayerPanel({ locale, layer }: { locale: string; layer: Exclude<Layer, "prophets"> }) {
  const t = lifestyleStrings(locale);
  const [res, eras] = await Promise.all([getLayerRecords(layer), getEras()]);
  const records = res.state === "ok" ? res.data : [];
  if (!records.length)
    return (
      <div className="lta-layer-body" data-testid="layer-empty">
        <EmptyState title={t.layers.emptyTitle}>
          <p>{t.layers.emptyBody}</p>
          {res.state === "not_configured" ? <p>{t.notConfigured}</p> : null}
          {res.state === "error" ? <p>{t.loadError}</p> : null}
        </EmptyState>
        <Scene scene={SCENE[layer]} labels={t.illustration} />
      </div>
    );
  const eraList = eras.state === "ok" ? eras.data : [];
  const groups: Array<{ key: string; title: string; rows: TopicRecord[] }> = eraList
    .map((e) => ({ key: e.id, title: locale === "ar" && e.name_ar ? e.name_ar : e.name_en, rows: records.filter((r) => r.era_id === e.id) }))
    .filter((g) => g.rows.length);
  const known = new Set(eraList.map((e) => e.id));
  const loose = records.filter((r) => !r.era_id || !known.has(r.era_id));
  if (loose.length) groups.push({ key: "none", title: t.layers.eraUnknown, rows: loose });
  return (
    <div className="lta-layer-body">
      {groups.map((g) => (
        <section key={g.key} className="lta-section" aria-labelledby={`lta-era-${g.key}`}>
          <h2 id={`lta-era-${g.key}`} className="zq-eyebrow">
            {g.title}
          </h2>
          {g.rows.map((r) => (
            <RecordCard key={r.id} r={r} t={t} title={r.title} body={r.body} />
          ))}
        </section>
      ))}
    </div>
  );
}
