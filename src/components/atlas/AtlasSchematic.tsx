"use client";

import { useCallback, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import type { PlaceCertainty } from "@/content/labels";
import { englishContent } from "@/lib/i18n/locales";
import { atlasStrings } from "@/lib/i18n/modules/atlas";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";
import { EvidenceLabel } from "@/components/ui/evidence";
import { Sheet } from "@/components/ui/Sheet";
import { usePanZoom, ZoomControls, type Size } from "@/components/ui/panzoom";

export interface AtlasStop {
  id: string;
  name: string;
  era: string;
  place: string;
  certainty: PlaceCertainty;
}

/** The lanes of the schematic, top to bottom. Unknown places are never drawn; they are listed under the drawing. */
const LANES: Array<Exclude<PlaceCertainty, "unknown">> = ["point", "region", "hypothesis", "disputed"];
const KIND = { point: "scholar", region: "estimate", hypothesis: "estimate", disputed: "disputed", unknown: "unknown" } as const;
const DX = 88;
const PAD = 72;
const TOP = 52;
const LANE_H = 78;

/**
 * The atlas as a schematic: left to right (right to left in Arabic) is journey order and each row is how certain the
 * place is. It is not a geographic map: no position stands for a coordinate. Touch pan and pinch-zoom, zoom buttons,
 * and a place panel (a bottom sheet on phones). The list of places on the page stays the text alternative.
 */
export function AtlasSchematic({ stops, focus, rtl = false }: { stops: AtlasStop[]; focus?: string; rtl?: boolean }) {
  const locale = useLocale();
  const t = atlasStrings(locale);
  const PLACE_TEXT = uiStrings(locale).place;
  const en = englishContent(locale);
  const placed = useMemo(() => stops.filter((s) => s.certainty !== "unknown"), [stops]);
  const unknown = useMemo(() => stops.filter((s) => s.certainty === "unknown"), [stops]);
  const content: Size = useMemo(() => ({ w: PAD * 2 + Math.max(0, placed.length - 1) * DX, h: TOP + LANES.length * LANE_H + 12 }), [placed.length]);
  const pos = useCallback(
    (i: number, c: PlaceCertainty) => {
      const x = PAD + i * DX;
      return { x: rtl ? content.w - x : x, y: TOP + LANES.indexOf(c as (typeof LANES)[number]) * LANE_H + LANE_H / 2 };
    },
    [rtl, content.w],
  );
  const focusIndex = placed.findIndex((s) => s.id === focus);

  const initial = useCallback(
    (vp: Size) => {
      const s = vp.w >= 900 ? Math.min(1, Math.max(0.7, vp.w / content.w)) : 1;
      const fx = focusIndex >= 0 ? pos(focusIndex, placed[focusIndex]!.certainty).x : rtl ? content.w : 0;
      const x = focusIndex >= 0 ? vp.w / 2 - fx * s : rtl ? vp.w - content.w * s : 0;
      return { s, x, y: Math.max(0, (vp.h - content.h * s) / 2) };
    },
    [content, focusIndex, placed, pos, rtl],
  );
  const pz = usePanZoom({ content, initial, min: 0.5, max: 2.5 });

  const [sel, setSel] = useState<{ stop: AtlasStop; opener: Element | null } | null>(null);
  const open = (stop: AtlasStop) => (e: MouseEvent) => {
    e.preventDefault();
    setSel({ stop, opener: e.currentTarget });
  };

  // Era bands: consecutive placed stops of the same era.
  const eras = useMemo(() => {
    const out: Array<{ title: string; from: number; to: number }> = [];
    placed.forEach((s, i) => {
      const last = out[out.length - 1];
      if (last && last.title === s.era) last.to = i;
      else out.push({ title: s.era, from: i, to: i });
    });
    return out;
  }, [placed]);

  const samePlace = sel ? stops.filter((s) => s.place === sel.stop.place && s.id !== sel.stop.id) : [];
  const describedBy = "atlas-schematic-help";

  return (
    <div className="zx-atlas">
      <p id={describedBy} className="zq-meta zx-note">
        {rtl ? t.helpRtl : t.help}
      </p>
      <div className="zx-stage">
        <div
          ref={pz.ref}
          className="zx-viewport"
          tabIndex={0}
          role="group"
          aria-label={t.schematic}
          aria-describedby={describedBy}
          data-scale={pz.view.s.toFixed(3)}
          data-x={pz.view.x.toFixed(1)}
          data-y={pz.view.y.toFixed(1)}
          {...pz.handlers}
        >
          <svg className="zx-svg" width="100%" height="100%" role="group" aria-label={t.placesGroup}>
            <defs>
              <pattern id="zx-hatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width={2} height={6} fill="var(--slate)" opacity={0.55} />
              </pattern>
            </defs>
            <g transform={pz.transform}>
              {LANES.map((c, i) => (
                <rect key={c} x={0} y={TOP + i * LANE_H} width={content.w} height={LANE_H} className={i % 2 ? "zx-lane zx-lane-alt" : "zx-lane"} />
              ))}
              {eras.map((e, i) => {
                const a = pos(e.from, "point").x;
                const b = pos(e.to, "point").x;
                const left = Math.min(a, b) - DX / 2;
                const width = Math.abs(b - a) + DX;
                const max = Math.floor(width / 7.2);
                return (
                  <g key={e.title + i} aria-hidden="true">
                    {i ? <line x1={rtl ? left + width : left} x2={rtl ? left + width : left} y1={8} y2={content.h - 4} className="zx-era-line" /> : null}
                    <text x={left + width / 2} y={30} textAnchor="middle" className="zx-era">
                      {e.title.length > max ? `${e.title.slice(0, Math.max(4, max - 1))}…` : e.title}
                    </text>
                  </g>
                );
              })}
              {placed.map((s, i) => {
                const { x, y } = pos(i, s.certainty);
                const isFocus = s.id === focus;
                return (
                  <a
                    key={s.id}
                    href={`/prophets/${s.id}#places`}
                    className="zx-node"
                    data-place={s.id}
                    data-focus={isFocus || undefined}
                    aria-label={`${s.name}: ${s.place}. ${PLACE_TEXT[s.certainty]}. ${t.openDetails}`}
                    onClick={open(s)}
                  >
                    <rect x={x - 32} y={y - 28} width={64} height={60} className="zx-hit" />
                    {isFocus ? <circle cx={x} cy={y - 6} r={17} className="zx-focus-ring" /> : null}
                    <Mark c={s.certainty} x={x} y={y - 6} />
                    <circle cx={x} cy={y - 6} r={20} className="zx-kbd-ring" />
                    <text x={x} y={y + 24} textAnchor="middle" className="zx-label">
                      {s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name}
                    </text>
                  </a>
                );
              })}
            </g>
            {/* Row names stay on screen while panning. */}
            <g aria-hidden="true">
              {LANES.map((c, i) => {
                const y = pz.view.y + (TOP + i * LANE_H + 14) * pz.view.s;
                if (y < 4 || y > pz.viewport.h - 4) return null;
                return (
                  <text key={c} x={rtl ? pz.viewport.w - 8 : 8} y={y} textAnchor={rtl ? "end" : "start"} className="zx-lane-name">
                    {PLACE_TEXT[c]}
                  </text>
                );
              })}
            </g>
          </svg>
        </div>
        <ZoomControls label={t.zoom} view={pz.view} min={pz.min} max={pz.max} onIn={() => pz.zoomBy(1.25)} onOut={() => pz.zoomBy(0.8)} onReset={pz.reset} />
      </div>
      {unknown.length ? (
        <div className="zx-unplaced">
          <EvidenceLabel kind="unknown">
            {PLACE_TEXT.unknown}: {t.notPlaced}
          </EvidenceLabel>
          <ul {...en}>
            {unknown.map((s) => (
              <li key={s.id} data-focus={s.id === focus || undefined}>
                <Link href={`/prophets/${s.id}#places`}>{s.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Sheet open={!!sel} opener={sel?.opener} onClose={() => setSel(null)} title={sel?.stop.place ?? ""}>
        {sel ? (
          <div className="zx-place">
            <EvidenceLabel kind={KIND[sel.stop.certainty]}>{PLACE_TEXT[sel.stop.certainty]}</EvidenceLabel>
            <dl className="zq-kv">
              <dt>{t.onJourney}</dt>
              <dd {...en}>
                {sel.stop.name} · {sel.stop.era}
              </dd>
              <dt>{t.position}</dt>
              <dd>{t.schematicOnly}</dd>
            </dl>
            {samePlace.length ? (
              <>
                <h3 className="zq-eyebrow">{t.alsoHere}</h3>
                <ul className="zx-also" {...en}>
                  {samePlace.map((s) => (
                    <li key={s.id}>
                      <Link href={`/prophets/${s.id}#places`}>{s.name}</Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <div className="zx-actions">
              <Link className="zq-btn zq-btn-primary" href={`/prophets/${sel.stop.id}#places`}>
                {t.readStoryOf(sel.stop.name)}
              </Link>
              <Link className="zq-btn zq-btn-secondary" href={`/timeline?selected=${sel.stop.id}`}>
                {t.showOnTimeline}
              </Link>
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function Mark({ c, x, y }: { c: PlaceCertainty; x: number; y: number }) {
  if (c === "point") return <circle cx={x} cy={y} r={8} className="zx-m-point" />;
  if (c === "region")
    return (
      <>
        <rect x={x - 15} y={y - 11} width={30} height={22} rx={10} className="zx-m-region" />
        <rect x={x - 15} y={y - 11} width={30} height={22} rx={10} fill="url(#zx-hatch)" className="zx-m-region-edge" />
      </>
    );
  if (c === "hypothesis") return <circle cx={x} cy={y} r={12} className="zx-m-hyp" />;
  return (
    <>
      <circle cx={x} cy={y} r={12} className="zx-m-disp" />
      <circle cx={x} cy={y} r={7} className="zx-m-disp" />
    </>
  );
}
