"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "@/components/redesign/useScrollSpy";

export interface DialStop {
  id: string;
  name: string;
  arabic: string;
  eraLabel: string;
  dateLabel: string;
  certainty: "relative" | "estimate" | "traditional" | "exact" | "unknown" | "disputed";
  certaintyLabel: string;
}
export interface DialStrings {
  label: string;
  prev: string;
  next: string;
  play: string;
  pause: string;
  searchLabel: string;
  searchPlaceholder: string;
  results: string;
  none: string;
  open: string;
  stopOf: string;
  position: string;
}

const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

/**
 * The home journey dial: every stop is a tick on a ring, a hand sweeps to the current one, and the centre names it.
 * Auto-plays (never under prefers-reduced-motion) and pauses while the pointer or focus is inside. Search jumps to a stop.
 * The ticks are decorative; a click on the ring picks the nearest stop for pointer users, and a labelled range input, Previous and Next serve the keyboard.
 */
export function JourneyDial({ stops, s, href }: { stops: DialStop[]; s: DialStrings; href: string }) {
  const n = stops.length;
  const [i, setI] = useState(0);
  const [acc, setAcc] = useState(0);
  const [auto, setAuto] = useState(false);
  const [hold, setHold] = useState(false);
  const [q, setQ] = useState("");
  const cur = useRef(0);
  cur.current = i;

  const go = (to: number) => {
    const from = cur.current;
    let d = to - from;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    setAcc((a) => a + (d * 360) / n);
    setI(to);
  };
  useEffect(() => {
    if (!prefersReducedMotion()) setAuto(true);
  }, []);
  useEffect(() => {
    if (!auto || hold) return;
    const t = window.setInterval(() => go((cur.current + 1) % n), 2600);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go reads refs and stable setters
  }, [auto, hold, n]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return stops.map((x, idx) => ({ x, idx })).filter(({ x }) => x.name.toLowerCase().includes(t) || x.arabic.includes(q.trim())).slice(0, 6);
  }, [q, stops]);

  const stop = stops[i]!;
  return (
    <div className="rd-dial-wrap">
      {/* Pointer convenience only: a click on the ring picks the nearest stop. The range input, Previous and Next do the same for the keyboard and assistive technology. */}
      <div
        className="rd-dial rd-dial-hit"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          const dist = Math.hypot(dx, dy) / (r.width / 2);
          if (dist < 0.62) return; // the centre is not a target
          const ang = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI);
          go(Math.round((ang / (2 * Math.PI)) * n) % n);
          setAuto(false);
        }}
        role="group"
        aria-label={s.label}
        onMouseEnter={() => setHold(true)}
        onMouseLeave={() => setHold(false)}
        onFocus={() => setHold(true)}
        onBlur={() => setHold(false)}
      >
        <span className="rd-dial-hand" aria-hidden="true" style={{ transform: `rotate(${acc}deg)` }} />
        {stops.map((x, idx) => {
          const a = (idx * 2 * Math.PI) / n;
          return <span key={x.id} aria-hidden="true" className="rd-tick" data-cert={x.certainty} data-on={idx === i} style={{ left: `${50 + 43 * Math.sin(a)}%`, top: `${50 - 43 * Math.cos(a)}%` }} />;
        })}
        <div className="rd-dial-core" aria-live="polite">
          <span className="rd-eyebrow">{stop.eraLabel}</span>
          <strong className="rd-dial-name">{stop.name}</strong>
          <span lang="ar" dir="rtl" className="rd-dial-ar">
            {stop.arabic}
          </span>
          <span className="rd-cert" data-cert={stop.certainty}>
            {stop.certaintyLabel}
          </span>
          <span className="rd-dial-date">{stop.dateLabel}</span>
        </div>
      </div>
      <p className="zq-meta" aria-hidden="true">
        {fmt(s.stopOf, { n: i + 1, total: n })}
      </p>
      <input type="range" className="rd-range" aria-label={s.position} min={0} max={n - 1} value={i} onChange={(e) => { go(Number(e.target.value)); setAuto(false); }} />
      <div className="rd-row">
        <button type="button" className="zq-btn zq-btn-secondary" onClick={() => { go((i + n - 1) % n); setAuto(false); }}>
          {s.prev}
        </button>
        <button type="button" className="zq-btn zq-btn-secondary" aria-pressed={auto} onClick={() => setAuto((a) => !a)}>
          {auto ? s.pause : s.play}
        </button>
        <button type="button" className="zq-btn zq-btn-secondary" onClick={() => { go((i + 1) % n); setAuto(false); }}>
          {s.next}
        </button>
      </div>
      <div className="rd-search">
        <label htmlFor="rd-dial-q" className="rd-eyebrow">
          {s.searchLabel}
        </label>
        <input id="rd-dial-q" className="zq-input" type="search" autoComplete="off" value={q} placeholder={s.searchPlaceholder} onChange={(e) => setQ(e.target.value)} />
        {q.trim() ? (
          <div role="group" aria-label={s.results} className="rd-chips">
            {results.length ? (
              results.map(({ x, idx }) => (
                <button key={x.id} type="button" className="rd-chip" onClick={() => { go(idx); setAuto(false); }}>
                  {x.name}
                </button>
              ))
            ) : (
              <span className="zq-meta" role="status">
                {s.none}
              </span>
            )}
          </div>
        ) : null}
      </div>
      <Link className="zq-btn zq-btn-primary zq-btn-link" href={href}>
        {s.open}
      </Link>
    </div>
  );
}
