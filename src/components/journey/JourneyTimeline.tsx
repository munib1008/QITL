"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { englishContent } from "@/lib/i18n/locales";
import { journeyStrings } from "@/lib/i18n/modules/home";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";
import type { JourneyEra, JourneyItem } from "@/content/journey";
import { CitationChip } from "@/components/ui/evidence";
import { EvidenceDrawer, type EvidenceTab } from "@/components/ui/EvidenceDrawer";
import { Rosette } from "@/components/ui/icons";
import { quranHref } from "@/lib/refs";
import { ProphetJourneyCard } from "./ProphetJourneyCard";

export type JourneyFilter = "all" | "prophet" | "milestone" | "dated";
export const JOURNEY_FILTERS: Array<[JourneyFilter, string]> = [
  ["all", "Complete journey"],
  ["prophet", "Prophets"],
  ["milestone", "Key events"],
  ["dated", "Dated history"],
];

export function matchesFilter(it: JourneyItem, f: JourneyFilter): boolean {
  return f === "all" || (f === "dated" ? it.dated : it.type === f);
}

/** Hold scroll-sync this long after any user action so the card you touched doesn't collapse under you. */
export const HOLD_MS = 1200;
/** A nearby stop takes over only when it is at least this much closer to the focus line than the current one. */
export const HYSTERESIS_PX = 48;
/** The focus line sits at 40% of the viewport height. */
export const FOCUS_LINE = 0.4;

/** Pure scroll-sync decision, exported for unit tests. */
export function pickActive(distances: Array<{ id: string; d: number }>, current: string): string {
  let best: { id: string; d: number } | undefined;
  let cd = Infinity;
  for (const x of distances) {
    if (x.id === current) cd = x.d;
    if (!best || x.d < best.d) best = x;
  }
  if (best && best.id !== current && best.d < cd - HYSTERESIS_PX) return best.id;
  return current;
}

type JT = ReturnType<typeof journeyStrings>;

function evidenceTabs(it: JourneyItem, t: JT, u: ReturnType<typeof uiStrings>, en: { lang?: "en"; dir?: "ltr" }): EvidenceTab[] {
  const q: Array<{ ref: string; label: string; href?: string }> = [];
  const hd: typeof q = [];
  const sc: typeof q = [];
  for (const s of it.surahs ?? [])
    for (const ps of s.passages) q.push({ ref: `Q ${ps}`, label: s.name + (s.named ? t.namedAfter : ""), href: quranHref(ps) });
  for (const r of it.refs ?? []) {
    const entry = { ref: r.ref, label: r.label, href: r.kind === "quran" ? quranHref(r.ref.replace(/^Q\s*/, "")) : undefined };
    (r.kind === "quran" ? q : r.kind === "hadith" ? hd : sc).push(entry);
  }
  const list = (a: typeof q, empty: string): ReactNode =>
    a.length ? (
      <ul className="zq-jc-refs">
        {a.map((r) => (
          <li key={r.ref + r.label}>
            <CitationChip href={r.href}>{r.ref}</CitationChip>
            <span>{r.label}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="zq-meta">{empty}</p>
    );
  const place = it.place ?? { name: t.unknown, certainty: "unknown" as const };
  return [
    { label: t.tabs.quran, count: q.length, content: list(q, t.noQuran) },
    { label: t.tabs.hadith, count: hd.length, content: list(hd, t.noHadith) },
    {
      label: t.tabs.context,
      content: (
        <div>
          <p className="zq-meta">
            <b style={{ color: "var(--ink)" }}>{t.date} </b>
            {it.era.label} — {u.era[it.era.certainty]}
          </p>
          <p className="zq-meta">
            <b style={{ color: "var(--ink)" }}>{u.place[place.certainty]}: </b>
            <span {...en}>{place.name}</span>
          </p>
          {it.order ? (
            <p className="zq-meta" {...en}>
              {it.order.label}
            </p>
          ) : null}
          {it.note ? (
            <p className="zq-meta" {...en}>
              {it.note}
            </p>
          ) : null}
          {sc.map((r) => (
            <p key={r.ref} className="zq-meta">
              {r.ref} — {r.label}
            </p>
          ))}
        </div>
      ),
    },
  ];
}

export interface JourneyTimelineProps {
  eras: JourneyEra[];
  intro?: ReactNode;
  initialActive?: string;
  scrollSync?: boolean;
  endLabel?: string | false;
  endNote?: string;
  endActions?: ReactNode;
  draft?: boolean;
  label?: string;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function JourneyTimeline({ eras, intro, initialActive, scrollSync = true, endLabel, endNote, endActions, draft = true, label }: JourneyTimelineProps) {
  const locale = useLocale();
  const t = journeyStrings(locale);
  const u = uiStrings(locale);
  const en = englishContent(locale);
  const all = useMemo(() => eras.flatMap((e) => e.items), [eras]);
  const [filter, setFilter] = useState<JourneyFilter>("all");
  const [active, setActive] = useState<string>(initialActive ?? all[0]?.id ?? "");
  const [evItem, setEvItem] = useState<JourneyItem | null>(null);
  const [paused, setPaused] = useState(false);
  /** Reveal state: ids hidden below the fold at load ("rv") and those since revealed ("in"). */
  const [reveal, setReveal] = useState<Record<string, "rv" | "in">>({});
  const root = useRef<HTMLElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const bg = useRef<HTMLDivElement>(null);
  const hold = useRef(0);
  const cur = useRef(active);
  cur.current = active;
  const modalOpen = useRef(false);
  modalOpen.current = evItem != null;

  const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pick = useCallback((id: string) => {
    hold.current = Date.now() + HOLD_MS;
    setActive(id);
  }, []);

  const visible = all.filter((it) => matchesFilter(it, filter));
  const idx = visible.findIndex((it) => it.id === active);
  const pos = Math.max(1, idx + 1);

  // The progress line fills to the active node.
  useIsoLayoutEffect(() => {
    const el = root.current;
    if (!el || !fill.current) return;
    const node = el.querySelector<HTMLElement>(`[data-node="${active}"]`);
    const line = el.querySelector<HTMLElement>(".zq-jt-line");
    if (!node || !line) return;
    const h = Math.max(0, node.getBoundingClientRect().top - line.getBoundingClientRect().top + 20);
    fill.current.style.height = `${h}px`;
  }, [active, filter]);

  // Reveal only stops below the fold at load, so nothing stays hidden if IntersectionObserver never fires.
  useEffect(() => {
    const el = root.current;
    if (!el || reduced() || !("IntersectionObserver" in window)) return;
    const below: Record<string, "rv"> = {};
    el.querySelectorAll<HTMLElement>(".zq-jt-item").forEach((n) => {
      if (n.getBoundingClientRect().top > window.innerHeight && n.dataset.id) below[n.dataset.id] = "rv";
    });
    setReveal(below);
    const io = new IntersectionObserver(
      (entries) => {
        const shown: string[] = [];
        for (const e of entries)
          if (e.isIntersecting) {
            const id = (e.target as HTMLElement).dataset.id;
            if (id) shown.push(id);
            io.unobserve(e.target);
          }
        if (shown.length) setReveal((r) => ({ ...r, ...Object.fromEntries(shown.map((id) => [id, "in" as const])) }));
      },
      { threshold: 0.08 },
    );
    el.querySelectorAll<HTMLElement>(".zq-jt-item").forEach((n) => {
      if (n.dataset.id && below[n.dataset.id]) io.observe(n);
    });
    return () => io.disconnect();
  }, [filter]);

  // Scroll-sync: the stop nearest 40% of the viewport becomes active, with hysteresis and a hold after user actions.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let last = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!reduced() && bg.current) bg.current.style.transform = `translate3d(0,${(window.scrollY * -0.08).toFixed(1)}px,0)`;
        // Stops scrolled past are revealed anyway.
        const passed: string[] = [];
        el.querySelectorAll<HTMLElement>(".zq-rv:not(.zq-in)").forEach((n) => {
          if (n.getBoundingClientRect().top < window.innerHeight && n.dataset.id) passed.push(n.dataset.id);
        });
        if (passed.length) setReveal((r) => ({ ...r, ...Object.fromEntries(passed.map((id) => [id, "in" as const])) }));
        // While held (after a click) or while the evidence panel is open, scrolling (including the browser's own
        // scroll anchoring and focus restoration) re-baselines instead of moving the active stop.
        if (!scrollSync || Date.now() < hold.current || modalOpen.current) {
          last = window.scrollY;
          return;
        }
        if (Math.abs(window.scrollY - last) < 4) return;
        last = window.scrollY;
        const mid = window.innerHeight * FOCUS_LINE;
        const ds: Array<{ id: string; d: number }> = [];
        el.querySelectorAll<HTMLElement>("[data-node]").forEach((n) => {
          const id = n.dataset.node!;
          let d = Math.abs(n.getBoundingClientRect().top - mid);
          // While the focus line is still inside the active stop's (expanded, possibly taller-than-screen) card,
          // it keeps the focus, so a reader can scroll down to its buttons without it collapsing.
          if (id === cur.current) {
            const r = n.closest(".zq-jt-item")?.getBoundingClientRect();
            if (r && r.top <= mid && r.bottom >= mid) d = 0;
          }
          ds.push({ id, d });
        });
        const next = pickActive(ds, cur.current);
        if (next !== cur.current) setActive(next);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollSync]);

  const jump = (id: string) => {
    pick(id);
    const n = root.current?.querySelector<HTMLElement>(`[data-node="${id}"]`);
    n?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
  };

  const changeFilter = (f: JourneyFilter) => {
    setFilter(f);
    const nv = all.filter((it) => matchesFilter(it, f));
    if (nv.length && !nv.some((it) => it.id === active)) pick(nv[0]!.id);
    else hold.current = Date.now() + HOLD_MS;
  };

  let side = 0;
  return (
    <section className="zq-jt" data-theme="journey" data-motion={paused ? "paused" : undefined} ref={root} aria-label={label ?? t.label}>
      <div className="zq-jt-bg" ref={bg} aria-hidden="true" />
      {intro ? <div className="zq-jt-intro">{intro}</div> : null}
      <div className="zq-jt-filters zq-glass" role="group" aria-label={t.show}>
        <span className="zq-jt-flabel">{t.exploreBy}</span>
        {JOURNEY_FILTERS.map(([f, text]) => (
          <button key={f} type="button" className="zq-jt-filter" aria-pressed={filter === f} onClick={() => changeFilter(f)} data-filter={f}>
            {t.filters[f] ?? text}
          </button>
        ))}
        <button type="button" className="zq-jt-filter zq-jt-motion" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
          {paused ? t.play : t.pause}
        </button>
      </div>
      <div
        className="zq-jt-progress"
        role="progressbar"
        aria-label={t.progress}
        aria-valuemin={1}
        aria-valuemax={visible.length}
        aria-valuenow={pos}
        data-testid="journey-progress"
      >
        <span style={{ width: `${(pos / Math.max(1, visible.length)) * 100}%` }} />
        <b>
          {pos} / {visible.length}
        </b>
      </div>
      <div className="zq-jt-body">
        <nav className="zq-jt-rail zq-glass" aria-label={t.jump}>
          <p className="zq-jt-rail-title">{t.yours}</p>
          <ol>
            {eras.map((e) => {
              const items = e.items.filter((it) => matchesFilter(it, filter));
              if (!items.length) return null;
              return (
                <li key={e.title}>
                  <p className="zq-jt-rail-era">{e.title}</p>
                  <ol>
                    {items.map((it) => (
                      <li key={it.id}>
                        <button type="button" className="zq-jt-rail-btn" aria-current={it.id === active || undefined} onClick={() => jump(it.id)}>
                          {it.name}
                        </button>
                      </li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="zq-jt-line">
          <span className="zq-jt-track" aria-hidden="true" />
          <span className="zq-jt-fill" ref={fill} aria-hidden="true" />
          <ol className="zq-jt-ol" data-testid="journey-line">
          {eras.map((e, ei) => {
            const items = e.items.filter((it) => matchesFilter(it, filter));
            if (!items.length) return null;
            return (
              <Fragment key={e.title}>
                <li className="zq-jt-era">
                  <div className="zq-jt-era-pill zq-glass">
                    <p className="zq-eyebrow">
                      {String(ei + 1).padStart(2, "0")} / {e.title}
                    </p>
                    {e.note ? <p className="zq-jt-era-note">{e.note}</p> : null}
                  </div>
                </li>
                {items.map((it) => {
                  const isA = it.id === active;
                  const s = side++ % 2 ? "r" : "l";
                  const rv = reveal[it.id];
                  return (
                    <li
                      key={it.id}
                      data-id={it.id}
                      data-stop={it.id}
                      className={cx("zq-jt-item", `zq-jt-${s}`, isA && "zq-jt-active", it.type === "milestone" && "zq-jt-ms", rv && "zq-rv", rv === "in" && "zq-in")}
                    >
                      <button
                        type="button"
                        className="zq-jt-node"
                        data-node={it.id}
                        aria-label={`${it.name}${isA ? " — details shown" : " — show details"}`}
                        aria-expanded={isA}
                        onClick={() => pick(it.id)}
                      >
                        <Rosette points={it.points} />
                      </button>
                      <div className="zq-jt-card">
                        <ProphetJourneyCard
                          item={it}
                          expanded={isA}
                          onToggle={() => pick(it.id)}
                          onEvidence={() => {
                            hold.current = Date.now() + HOLD_MS;
                            setEvItem(it);
                          }}
                        />
                      </div>
                      <div className="zq-jt-when">
                        <strong>{it.era.label}</strong>
                        <span>{u.era[it.era.certainty]}</span>
                      </div>
                    </li>
                  );
                })}
              </Fragment>
            );
          })}
          {endLabel !== false ? (
            <li className="zq-jt-end">
              <div className="zq-jt-era-pill zq-glass">
                <p className="zq-eyebrow">{endLabel ?? t.continues}</p>
                {endNote ? <p className="zq-jt-era-note">{endNote}</p> : null}
                {endActions}
              </div>
            </li>
          ) : null}
          </ol>
        </div>
      </div>
      {evItem ? (
        <EvidenceDrawer
          theme="journey"
          claim={`${evItem.name} — ${evItem.summary}`}
          status={(evItem.evidence ?? ["quran"])[0]}
          tabs={evidenceTabs(evItem, t, u, en)}
          onClose={() => {
            hold.current = Date.now() + HOLD_MS;
            setEvItem(null);
          }}
          footer={
            draft ? t.draftFooter : t.approvedFooter
          }
        />
      ) : null}
    </section>
  );
}
