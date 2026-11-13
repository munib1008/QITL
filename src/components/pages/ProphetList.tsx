"use client";

import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icons";

export interface ListStop {
  id: string;
  /** 1-based position on the journey (shown as "Chapter 03"). */
  chapter: string;
  name: string;
  arabic: string;
  honorific: string;
  subtitle?: string;
  eraLabel: string;
  /** Rendered era tag (server-rendered node so it keeps its certainty wording). */
  eraTag: React.ReactNode;
  /** First cited passage, e.g. "Q 12:3–101". */
  cite?: string;
  disputed?: React.ReactNode;
  /** Lower-cased text the filter matches against. */
  haystack: string;
}
export interface ListEra {
  title: string;
  note?: string;
  english: boolean;
  stops: ListStop[];
}
export interface ListStrings {
  filter: string;
  filterLabel: string;
  count: string;
  none: string;
  noneNote: string;
  open: string;
  chapter: string;
}

/**
 * The journey list in the design's layout: era groups on the left, stop cards on the right, a filter above. Every card is
 * a link (the whole card), shows its era certainty, its first Quran citation and whether its place in the order is disputed.
 * The full list is server-rendered, so it reads without scripts; the filter only narrows it.
 */
export function ProphetList({ eras, s }: { eras: ListEra[]; s: ListStrings }) {
  const id = useId();
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q.trim().toLowerCase());
  const total = eras.reduce((n, e) => n + e.stops.length, 0);
  const shown = useMemo(() => eras.map((e) => ({ ...e, stops: e.stops.filter((x) => !dq || x.haystack.includes(dq)) })).filter((e) => e.stops.length), [eras, dq]);
  const n = shown.reduce((a, e) => a + e.stops.length, 0);
  return (
    <section className="qs section">
      <div className="toolbar">
        <label className="field" htmlFor={`${id}-q`}>
          <Icon.search />
          <span className="sr-only">{s.filterLabel}</span>
          <input id={`${id}-q`} type="search" autoComplete="off" spellCheck={false} placeholder={s.filter} value={q} onChange={(e) => setQ(e.target.value)} aria-controls={`${id}-list`} />
        </label>
        <span className="count" role="status" aria-live="polite">
          {s.count.replace("{n}", String(n)).replace("{total}", String(total))}
        </span>
      </div>
      <div className="tl" id={`${id}-list`}>
        {shown.length ? (
          shown.map((era, i) => (
            <section key={era.title} className="q-tl-era" aria-label={era.title}>
              <div className="eh">
                <div className="eyebrow" {...(era.english ? { lang: "en", dir: "ltr" } : {})}>
                  {String(i + 1).padStart(2, "0")} / {era.title}
                </div>
                {era.note ? <span {...(era.english ? { lang: "en", dir: "ltr" } : {})}>{era.note}</span> : null}
              </div>
              <div className="tl-items">
                {era.stops.map((x) => (
                  <article key={x.id} className="stopcard">
                    <Link className="go" href={`/prophets/${x.id}`} aria-label={`${s.open}: ${x.name}`} />
                    <div className="top">
                      <span className="no">
                        {s.chapter} {x.chapter}
                      </span>
                      {x.eraTag}
                    </div>
                    <h3>
                      {x.name} <small lang="ar">{x.arabic}</small> {x.honorific ? <small lang="ar">{x.honorific}</small> : null}
                    </h3>
                    {x.subtitle ? <p>{x.subtitle}</p> : null}
                    <div className="row">
                      {x.cite ? (
                        <span className="cite" dir="ltr">
                          {x.cite}
                        </span>
                      ) : null}
                      {x.disputed}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="empty2">
            <b>{s.none}</b>
            <p>{s.noneNote}</p>
          </div>
        )}
      </div>
    </section>
  );
}
