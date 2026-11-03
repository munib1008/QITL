"use client";
import "@/styles/timeline.css";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { TrackBadge } from "@/components/timeline/TrackIcon";
import { completeHref, TRACK_IDS, type TrackId } from "@/lib/events/tracks";
import type { DraftEra, DraftItem, LastHourSign } from "@/content/draftAtlas";
import { useSectionSpy } from "./useScrollSpy";

export interface ScrollStrings {
  categories: string;
  showAll: string;
  noneSelected: string;
  eraOf: string;
  progress: string;
  preview: string;
  selected: string;
  start: string;
  date: string;
  more: string;
  count: string;
  draftBanner: string;
  futureTitle: string;
  futureNote: string;
  majorSign: string;
  future: string;
  toLastHour: string;
}

type Cat = TrackId | "future";
interface Entry {
  id: string;
  title: string;
  cat: Cat;
  era: string;
  refs: string[];
  date: string | null;
  note?: string;
  major?: boolean;
  evidence?: LastHourSign["evidence"];
  source?: string | null;
}

const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
const ayahHref = (ref: string) => {
  const m = /^(\d{1,3}):(\d{1,3})/.exec(ref);
  return m ? `/quran/${m[1]}#ayah-${m[2]}` : undefined;
};

/**
 * The Complete Timeline as a scroll story, for when the database has nothing published (draft inventory, labelled).
 * A sticky stage follows the era in view; categories filter instantly; one calm focus card previews on hover and pins on
 * click. Eras reveal once as they are reached. Nothing is hidden before the first measurement, and all motion stops
 * under prefers-reduced-motion. The future era carries the signs of the Last Hour with no date and no countdown.
 */
export function EraScrollTimeline({
  eras,
  items,
  signs,
  tracks,
  s,
  initial,
  englishAttrs,
}: {
  eras: DraftEra[];
  items: DraftItem[];
  signs: LastHourSign[];
  tracks: Array<{ id: TrackId; name: string; note: string }>;
  s: ScrollStrings;
  initial: TrackId[];
  englishAttrs: { lang?: string; dir?: string };
}) {
  const cats: Array<{ id: Cat; name: string }> = [...tracks.map((t) => ({ id: t.id as Cat, name: t.name })), { id: "future", name: s.futureTitle }];
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(cats.map((c) => [c.id, c.id === "future" || initial.includes(c.id as TrackId)])));
  const [pin, setPin] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const base: Entry[] = items.map((i) => ({ id: i.slug, title: i.title, cat: i.track, era: i.era, refs: i.refs, date: i.date }));
    const fut: Entry[] = signs.map((x) => ({ id: `sign-${x.id}`, title: x.title, cat: "future", era: "f", refs: x.refs, date: null, note: x.note, major: x.major, evidence: x.evidence, source: x.source }));
    return [...base, ...fut];
  }, [items, signs]);
  const allEras: DraftEra[] = useMemo(() => [...eras, { k: "f", title: s.futureTitle, note: s.futureNote }], [eras, s.futureTitle, s.futureNote]);
  const visible = entries.filter((e) => on[e.cat]);
  const shownEras = allEras.filter((e) => visible.some((v) => v.era === e.k));
  const spy = useSectionSpy("era", [visible.length]);
  const active = shownEras.find((e) => e.k === spy.active) ?? shownEras[0];
  const inActive = visible.filter((v) => v.era === active?.k);
  const catOf = (c: Cat) => cats.find((x) => x.id === c)!;

  // Keep the URL in step with the chosen tracks (the same ?tracks= the database view uses).
  useEffect(() => {
    const sel = TRACK_IDS.filter((t) => on[t]);
    try {
      const prefix = /^\/(ar|ur)(?=\/|$)/.exec(window.location.pathname)?.[0] ?? "";
      window.history.replaceState(null, "", prefix + completeHref(sel));
    } catch {
      // history unavailable: the selection stays in the page
    }
  }, [on]);
  // A pin from another era is dropped when the reader scrolls on.
  useEffect(() => setPin(null), [active?.k]);

  const focusId = hov ?? pin ?? inActive[0]?.id ?? null;
  const focus = visible.find((v) => v.id === focusId);
  const how = hov ? s.preview : pin ? s.selected : s.start;
  const counts = cats.map((c) => ({ ...c, n: entries.filter((e) => e.cat === c.id).length }));
  const eraIdx = Math.max(0, shownEras.findIndex((e) => e.k === active?.k));
  const prog = shownEras.length ? Math.min(1, (eraIdx + spy.p) / shownEras.length) : 0;
  const evKind = (k: LastHourSign["evidence"][number]) => k;

  return (
    <div className="rd-scroll" data-testid="era-scroll" data-shown={visible.length}>
      <p className="tl-synthetic" role="note" data-testid="draft-banner">
        {s.draftBanner}
      </p>
      <div className="rd-cats" role="group" aria-label={s.categories}>
        {counts.map((c) => (
          <button key={c.id} type="button" className="rd-cat" data-track={c.id} aria-pressed={!!on[c.id]} onClick={() => setOn((o) => ({ ...o, [c.id]: !o[c.id] }))}>
            <TrackBadge track={c.id} />
            <span>
              {c.name} <span className="rd-n">{c.n}</span>
            </span>
          </button>
        ))}
        <button type="button" className="rd-chip" onClick={() => setOn(Object.fromEntries(cats.map((c) => [c.id, true])))}>
          {s.showAll}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="zq-meta" role="status" data-testid="none-shown">
          {s.noneSelected}
        </p>
      ) : (
        <div className="rd-split">
          <aside className="rd-stage" aria-label={s.progress}>
            <div className="rd-progress" role="progressbar" aria-label={s.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(prog * 100)}>
              <span style={{ width: `${prog * 100}%` }} />
            </div>
            {active ? (
              <div className="rd-card rd-eracard">
                <span className="rd-ghost" aria-hidden="true" style={{ transform: `translateY(${spy.p * 36}px)` }}>
                  {String(eraIdx + 1).padStart(2, "0")}
                </span>
                <p className="rd-eyebrow">{fmt(s.eraOf, { n: eraIdx + 1, total: shownEras.length })}</p>
                <h2 className="rd-era-title" {...englishAttrs}>
                  {active.title}
                </h2>
                <p className="zq-meta" {...englishAttrs}>
                  {active.note}
                </p>
              </div>
            ) : null}
            <div className="rd-card rd-focus" aria-live="polite" data-testid="focus-card">
              {focus ? (
                <>
                  <div className="rd-focus-head">
                    <TrackBadge track={focus.cat} size="lg" />
                    <div>
                      <p className="rd-eyebrow">
                        {catOf(focus.cat).name} · {how}
                      </p>
                      <p className="rd-focus-title" {...englishAttrs}>
                        {focus.title}
                      </p>
                    </div>
                  </div>
                  {focus.major ? <p className="rd-note rd-warn">{s.majorSign}</p> : null}
                  {focus.date ? (
                    <p className="rd-small">
                      <b>{s.date}:</b> <span {...englishAttrs}>{focus.date}</span>
                    </p>
                  ) : null}
                  {focus.note ? (
                    <p className="rd-small zq-meta" {...englishAttrs}>
                      {focus.note}
                      {focus.source ? ` ${focus.source}.` : ""}
                    </p>
                  ) : null}
                  <div className="rd-chips">
                    {focus.evidence?.map((k) => <EvidenceLabel key={k} kind={evKind(k)} />)}
                    {focus.refs.slice(0, 4).map((r) => (
                      <CitationChip key={r} href={ayahHref(r)}>{`Q ${r}`}</CitationChip>
                    ))}
                    {focus.refs.length > 4 ? <span className="zq-meta">{fmt(s.more, { n: focus.refs.length - 4 })}</span> : null}
                  </div>
                </>
              ) : null}
            </div>
          </aside>

          <div className="rd-flow">
            {shownEras.map((e) => {
              const list = visible.filter((v) => v.era === e.k);
              const reached = !spy.measured || spy.reached[e.k];
              return (
                <section key={e.k} className="rd-era" aria-labelledby={`era-h-${e.k}`}>
                  <div className="rd-era-head" id={`era-${e.k}`} data-spy={e.k} data-spy-group="era" data-reached={reached}>
                    <p className="rd-eyebrow">{fmt(s.count, { n: list.length })}</p>
                    <h3 id={`era-h-${e.k}`} className="rd-h3" {...englishAttrs}>
                      {e.title}
                    </h3>
                  </div>
                  <ul className="rd-grid">
                    {list.map((v, idx) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          className="rd-tile"
                          data-track={v.cat}
                          data-reached={reached}
                          style={{ ["--i" as string]: Math.min(idx, 16) }}
                          aria-pressed={pin === v.id}
                          onClick={() => setPin((p) => (p === v.id ? null : v.id))}
                          onMouseEnter={() => setHov(v.id)}
                          onMouseLeave={() => setHov((h) => (h === v.id ? null : h))}
                          onFocus={() => setHov(v.id)}
                          onBlur={() => setHov((h) => (h === v.id ? null : h))}
                        >
                          <TrackBadge track={v.cat} />
                          <span className="rd-tile-title" {...englishAttrs}>
                            {v.title}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {e.k === "f" ? (
                    <p className="rd-small">
                      <Link href="/last-hour" className="rd-link">{s.toLastHour}</Link>
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
