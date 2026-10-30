import { buildLanes, LIFESPAN_KINDS, type LifespanRecord } from "@/lib/lifestyle/model";
import type { LifestyleStrings } from "@/lib/i18n/modules/lifestyle";
import { CategoryBadge, RecordMeta } from "./Evidence";

const W = 300;
const H = 28;

/**
 * Lifespan evidence in separate lanes. Each evidence kind and measure has its own lane, its own scale and its own
 * axis label; a record is drawn as a point (one value) or a range bar (low–high), never joined to another record by a
 * line, so the chart can never read as one trend. Lanes with no published record say so. Numbers shown are only
 * those in published records; nothing is computed or interpolated.
 */
export function LifespanLanes({ records, t, showEmptyKinds = true }: { records: LifespanRecord[]; t: LifestyleStrings; showEmptyKinds?: boolean }) {
  const lanes = buildLanes(records.filter((r) => r.kind !== "speculative_theory"));
  const present = new Set(lanes.map((l) => l.kind));
  const empty = showEmptyKinds ? LIFESPAN_KINDS.filter((k) => k !== "speculative_theory" && !present.has(k)) : [];
  return (
    <figure className="lta-lanes" data-testid="lifespan-lanes" aria-label={t.longevity.chartTitle}>
      <figcaption>
        <b>{t.longevity.chartTitle}</b>
        <span className="zq-meta">{t.longevity.chartNote}</span>
      </figcaption>
      <ol className="lta-lane-list">
        {lanes.map((lane) => (
          <li key={lane.key} className="lta-lane" data-lane={lane.key} data-testid="lane">
            <h3 className="lta-lane-h">
              {t.kinds[lane.kind]}
              {lane.measure ? <span className="zq-meta"> · {t.measures[lane.measure]}</span> : null}
            </h3>
            <ul className="lta-lane-records">
              {lane.records.map((r) => {
                const lo = r.value_low ?? r.value_years;
                const hi = r.value_high ?? r.value_years;
                const x = (v: number) => (lane.max > 0 ? 8 + (v / lane.max) * (W - 16) : 8);
                return (
                  <li key={r.id} data-record={r.id}>
                    {lo != null && hi != null ? (
                      <svg viewBox={`0 0 ${W} ${H}`} className="lta-lane-svg" role="img" aria-label={`${t.kinds[lane.kind]}: ${lo === hi ? lo : `${lo}–${hi}`}`}>
                        <line x1={8} x2={W - 8} y1={H / 2} y2={H / 2} className="lta-lane-axis" />
                        {lo === hi ? (
                          <circle cx={x(lo)} cy={H / 2} r={5} className="lta-lane-point" data-mark="point" />
                        ) : (
                          <rect x={x(lo)} y={H / 2 - 5} width={Math.max(2, x(hi) - x(lo))} height={10} rx={5} className="lta-lane-range" data-mark="range" />
                        )}
                      </svg>
                    ) : null}
                    <p className="lta-lane-value">
                      {lo != null && hi != null ? <b dir="ltr">{lo === hi ? lo : `${lo}–${hi}`}</b> : null}
                      {r.statement ? <span> {r.statement}</span> : null}
                      {r.population ? <span className="zq-meta"> · {r.population}</span> : null}
                    </p>
                    {r.value_note ? <p className="zq-meta">{r.value_note}</p> : null}
                    <RecordMeta r={r} t={t} />
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
        {empty.map((k) => (
          <li key={k} className="lta-lane lta-lane-empty" data-lane={`${k}:empty`} data-testid="lane">
            <h3 className="lta-lane-h">{t.kinds[k]}</h3>
            <p className="zq-meta">{t.longevity.laneEmpty}</p>
          </li>
        ))}
      </ol>
      <p className="lta-lanes-key">
        <CategoryBadge category="A" t={t} /> <CategoryBadge category="B" t={t} /> <CategoryBadge category="C" t={t} />
      </p>
    </figure>
  );
}
