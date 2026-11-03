"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/components/redesign/useScrollSpy";
import type { DialName } from "@/content/asmaDial";

export interface NamesDialStrings {
  label: string;
  prev: string;
  next: string;
  play: string;
  pause: string;
  position: string;
  open: string;
  of: string;
  inList: string;
  draft: string;
}

/**
 * A dial of the Names in the educational list: a tick for each Name, a hand that sweeps to the current one, the Name
 * in the centre. It counts the Names it is given and never states a total: the enumeration is not established here.
 * Keyboard users get Previous / Next and a labelled range input; the ticks are for the pointer only. Auto-play never
 * starts under prefers-reduced-motion and pauses while the pointer or focus is inside.
 */
export function NamesDial({ names, s, locale }: { names: DialName[]; s: NamesDialStrings; locale: string }) {
  const n = names.length;
  const [i, setI] = useState(0);
  const [acc, setAcc] = useState(0);
  const [auto, setAuto] = useState(false);
  const [hold, setHold] = useState(false);
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
    if (!auto || hold || n < 2) return;
    const t = window.setInterval(() => go((cur.current + 1) % n), 2400);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go reads refs and stable setters
  }, [auto, hold, n]);

  if (n === 0) return null;
  const name = names[i]!;
  const stop = () => setAuto(false);
  return (
    <div className="rd-dial-wrap" data-testid="names-dial">
      <div className="rd-dial" role="group" aria-label={s.label} onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}>
        <span className="rd-dial-hand" aria-hidden="true" style={{ transform: `rotate(${acc}deg)` }} />
        {names.map((x, idx) => {
          const a = (idx * 2 * Math.PI) / n;
          return (
            <button
              key={x.slug}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className="rd-tick rd-tick-sm"
              aria-pressed={idx === i}
              onClick={() => {
                go(idx);
                stop();
              }}
              style={{ left: `${50 + 44 * Math.sin(a)}%`, top: `${50 - 44 * Math.cos(a)}%` }}
            />
          );
        })}
        <div className="rd-dial-core" aria-live="polite">
          <span lang="ar" dir="rtl" className="rd-names-ar" data-testid="dial-ar">
            {name.vowelled}
          </span>
          <strong className="rd-names-tr" dir="ltr">
            {name.transliteration}
          </strong>
          {name.meaning ? <span className="rd-dial-date">{name.meaning}</span> : null}
          {name.draft ? <span className="rd-cert" data-cert="relative">{s.draft}</span> : null}
        </div>
      </div>
      <p className="zq-meta" dir="ltr">
        {i + 1} {s.of} {n} {s.inList}
      </p>
      <div className="rd-row">
        <button type="button" className="zq-btn zq-btn-secondary" onClick={() => { go((i + n - 1) % n); stop(); }}>
          {s.prev}
        </button>
        <button type="button" className="zq-btn zq-btn-secondary" aria-pressed={auto} onClick={() => setAuto((a) => !a)}>
          {auto ? s.pause : s.play}
        </button>
        <button type="button" className="zq-btn zq-btn-secondary" onClick={() => { go((i + 1) % n); stop(); }}>
          {s.next}
        </button>
      </div>
      <input type="range" className="rd-range" aria-label={s.position} min={0} max={n - 1} value={i} onChange={(e) => { go(Number(e.target.value)); stop(); }} />
      <Link className="zq-btn zq-btn-primary zq-btn-link" href={`/asma/${name.slug}`} lang={locale}>
        {s.open}
      </Link>
    </div>
  );
}
