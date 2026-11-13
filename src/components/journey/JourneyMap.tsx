"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/icons";

export interface MapStop {
  id: string;
  name: string;
  arabic: string;
  honorific: string;
  chapter: string;
  kind: "prophet" | "milestone";
  eraIndex: number;
  /** Era label with its certainty already worded ("Era of Ibrahim's descendants", "Approximate", ...). */
  eraLabel: string;
  summary: string;
  href: string;
}
export interface MapStrings {
  label: string;
  heading: string;
  note: string;
  keyHint: string;
  chapter: string;
  milestone: string;
  open: string;
  of: string;
  /** Localized era titles, one per region. */
  eras: string[];
}

const W = 1200;
const H = 360;

/**
 * The home journey map: a symbolic map (not geographic, not to scale) of every stop in order, grouped in era regions.
 * Selecting a stop shows a card with its draft summary and a link to its page; arrows move, Enter opens. Positions are
 * computed from the order only, so the map never implies a distance or a date.
 */
export function JourneyMap({ stops, s, badge }: { stops: MapStop[]; s: MapStrings; badge: ReactNode }) {
  const router = useRouter();
  const [sel, setSel] = useState(0);
  const refs = useRef<(SVGGElement | null)[]>([]);
  const regions = s.eras.length;
  const regW = W / regions;
  const perEra = Array.from({ length: regions }, (_, e) => stops.filter((x) => x.eraIndex === e));
  let g = 0;
  const pts = perEra.flatMap((items, e) =>
    items.map((it, k) => {
      const t = items.length === 1 ? 0.5 : k / (items.length - 1);
      const x = e * regW + 40 + t * (regW - 80);
      const y = 190 + Math.sin(g++ * 0.62) * 84;
      return { it, x, y };
    }),
  );
  const ordered = pts.map((p) => p.it);
  const path = (to: number) => {
    let d = `M${pts[0]!.x},${pts[0]!.y}`;
    for (let i = 1; i <= to; i++) {
      const a = pts[i - 1]!, b = pts[i]!, mx = (a.x + b.x) / 2;
      d += ` C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
    }
    return d;
  };
  const cur = pts[sel]!;
  const labeled = new Set(["adam", "nuh", "ibrahim", "yusuf", "musa", "isa", "muhammad", "passing"]);

  function onKey(e: KeyboardEvent<SVGGElement>, i: number) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(pts[i]!.it.href);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const n = Math.max(0, Math.min(pts.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)));
      setSel(n);
      refs.current[n]?.focus();
    }
  }

  return (
    <div className="maprow">
      <div className="mapwide">
        <div className="head">
          <span>{s.heading}</span>
          <span>{s.note}</span>
        </div>
        <div className="scroller">
          <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={s.label}>
            {s.eras.map((title, i) => (
              <g key={title}>
                <rect className={`reg${cur.it.eraIndex === i ? " lit" : ""}`} x={i * regW + 8} y={40} width={regW - 16} height={300} rx={18} />
                <text className="reglab" x={i * regW + 20} y={28} {...(title.length * 8 > regW - 28 ? { textLength: regW - 28, lengthAdjust: "spacingAndGlyphs" as const } : {})}>
                  {String(i + 1).padStart(2, "0")} {title}
                </text>
              </g>
            ))}
            <path className="path0" d={path(pts.length - 1)} />
            <path className="path1" d={sel ? path(sel) : ""} />
            {pts.map(({ it, x, y }, i) => (
              <g
                key={it.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={`stop${labeled.has(it.id) ? " lab" : ""}${i === sel ? " sel" : ""}`}
                tabIndex={0}
                role="button"
                aria-label={it.name}
                aria-pressed={i === sel}
                onClick={() => setSel(i)}
                onFocus={() => setSel(i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <circle className="halo" cx={x} cy={y} r={18} />
                <circle cx={x} cy={y} r={7} />
                <text x={x} y={y + (y >= 190 ? 30 : -18)} textAnchor={x > 1150 ? "end" : x < 50 ? "start" : "middle"}>
                  {it.name}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="foot">
          <span className="keyhint">{s.keyHint}</span>
        </div>
      </div>
      <aside className="selcard" aria-live="polite">
        <div className="eyebrow">
          {(cur.it.kind === "milestone" ? s.milestone : s.chapter)} {Number(cur.it.chapter)} {s.of} {ordered.length}
        </div>
        <p className="nm">{cur.it.name}</p>
        <span className="ar" lang="ar" dir="rtl">
          {cur.it.arabic} {cur.it.honorific}
        </span>
        <p className="era-label">{cur.it.eraLabel}</p>
        <p>{cur.it.summary}</p>
        {badge}
        <div className="acts">
          <Link className="btn gold" href={cur.it.href}>
            {s.open} <Icon.arrowRight />
          </Link>
        </div>
      </aside>
    </div>
  );
}
