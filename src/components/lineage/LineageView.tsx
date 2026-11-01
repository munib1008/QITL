"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/misc";
import { englishContent } from "@/lib/i18n/locales";
import { lineageStrings } from "@/lib/i18n/modules/lineage";
import { useLocale } from "@/lib/i18n/useLocale";
import { LINEAGE_CLASSES, type LineageClass } from "@/lib/lineage/classes";
import { findLineagePath } from "@/lib/lineage/path";
import type { LineageCounts, LineageDoc, Route } from "@/lib/lineage/types";
import { AssessmentPanel, type Selection } from "./AssessmentPanel";
import { EvidenceChip, EvidenceLegend } from "./EvidenceChip";
import { RouteGraph } from "./RouteGraph";

/** Counts only: how many items are under review, never a title. */
export function LineageCountsList({ counts }: { counts: LineageCounts }) {
  const t = lineageStrings(useLocale());
  const rows: Array<[string, { published: number; underReview: number }]> = [
    [t.countLinks, counts.links],
    [t.countGaps, counts.gaps],
    [t.countClaims, counts.nodeClaims],
    [t.countWitnesses, counts.witnesses],
  ];
  return (
    <section aria-labelledby="ln-counts-h">
      <h3 id="ln-counts-h" className="zq-eyebrow">
        {t.countsTitle}
      </h3>
      <ul className="ln-counts">
        {rows.map(([label, c]) => (
          <li key={label}>
            <strong>{label}</strong>
            <span>{t.countLine(c.published, c.underReview)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Outline({ route, doc, enabled, nameOf, onSelect }: { route: Route; doc: LineageDoc; enabled: ReadonlySet<LineageClass>; nameOf: (id: string) => string; onSelect: (s: Selection) => void }) {
  const t = lineageStrings(useLocale());
  const en = englishContent(useLocale());
  const people = [route.steps[0]!.ancestor, ...route.steps.map((s) => s.descendant)];
  return (
    <ol className="ln-outline" aria-label={t.outlineTitle}>
      {people.map((p, i) => {
        const step = route.steps[i];
        return (
          <li key={`${p}-${i}`} data-person={p}>
            <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <b {...en}>{nameOf(p)}</b>
              <button type="button" className="zq-btn zq-btn-quiet ln-btn" onClick={() => onSelect({ kind: "person", id: p })}>
                {t.assessPerson}
                <span className="sr-only">: {nameOf(p)}</span>
              </button>
            </span>
            {step ? (
              <div className="ln-step" role="group" aria-label={t.outlineStep(nameOf(step.ancestor), nameOf(step.descendant))}>
                {step.options.length > 1 ? <span className="zq-meta">{t.competingTitle}</span> : null}
                {step.options.map((o) => {
                  const shown = enabled.has(o.evidenceClass);
                  const item = o.type === "gap" ? doc.gaps.find((g) => g.id === o.id) : doc.links.find((l) => l.id === o.id);
                  if (!shown) return <span key={o.id} className="zq-meta">{t.hiddenByFilter(1)}</span>;
                  return (
                    <div key={o.id} className="ln-opt-row" data-class={o.evidenceClass} data-type={o.type}>
                      {o.type === "gap" ? <span className="ln-gaptag">{t.gapTitle}</span> : <span>{t.linkWord}</span>}
                      <EvidenceChip cls={o.evidenceClass} />
                      {item?.tradition ? <span className="zq-meta" {...en}>{item.tradition}</span> : null}
                      <button type="button" className="zq-btn zq-btn-secondary ln-btn" onClick={() => onSelect({ kind: o.type, id: o.id })}>
                        {o.type === "gap" ? t.assessGap : t.assess}
                        <span className="sr-only">: {t.outlineStep(nameOf(step.ancestor), nameOf(step.descendant))}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The lineage view: legend, evidence filter, and the route(s) from the first person to the last through PUBLISHED
 * reviewed links only. With nothing published it shows the designed empty state with counts and no titles; where the
 * published links stop short it says "Not established" and lists what is published so far.
 */
export function LineageView({ doc, counts, start, end, initialClasses = null }: { doc: LineageDoc; counts: LineageCounts; start: string; end: string; initialClasses?: LineageClass[] | null }) {
  const locale = useLocale();
  const t = lineageStrings(locale);
  const en = englishContent(locale);
  const [enabled, setEnabled] = useState<ReadonlySet<LineageClass>>(new Set(initialClasses && initialClasses.length ? initialClasses : LINEAGE_CLASSES));
  const [sel, setSel] = useState<Selection>(null);
  const panel = useRef<HTMLElement>(null);

  const path = useMemo(() => findLineagePath(doc, start, end), [doc, start, end]);
  const names = useMemo(() => new Map(doc.people.map((p) => [p.id, locale === "ar" && p.nameAr ? p.nameAr : p.name])), [doc.people, locale]);
  const nameOf = useCallback((id: string) => names.get(id) ?? id, [names]);

  const toggle = (c: LineageClass) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      try {
        const url = new URL(window.location.href);
        if (next.size === LINEAGE_CLASSES.length) url.searchParams.delete("classes");
        else url.searchParams.set("classes", LINEAGE_CLASSES.filter((x) => next.has(x)).join(","));
        window.history.replaceState(null, "", url);
      } catch {
        /* a URL that cannot be updated is not an error */
      }
      return next;
    });
  const showAll = () => setEnabled(new Set(LINEAGE_CLASSES));

  const select = (s: Selection) => {
    setSel(s);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => panel.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }));
  };

  const nothing = doc.links.length + doc.gaps.length === 0;

  return (
    <div className="ln" data-path-status={nothing ? "empty" : path.status}>
      <EvidenceLegend />

      {nothing ? (
        <>
          <EmptyState title={t.emptyTitle}>
            <p>{t.emptyBody}</p>
          </EmptyState>
          <LineageCountsList counts={counts} />
        </>
      ) : (
        <>
          <fieldset className="ln-filter">
            <legend>{t.filterTitle}</legend>
            <p className="zq-meta" style={{ margin: "0 0 4px" }}>
              {t.filterHelp}
            </p>
            <div className="ln-filter-list">
              {LINEAGE_CLASSES.map((c) => (
                <label key={c}>
                  <input type="checkbox" checked={enabled.has(c)} onChange={() => toggle(c)} />
                  <EvidenceChip cls={c} short />
                </label>
              ))}
            </div>
            {enabled.size < LINEAGE_CLASSES.length ? (
              <button type="button" className="zq-btn zq-btn-quiet ln-btn" onClick={showAll}>
                {t.showAll}
              </button>
            ) : null}
          </fieldset>

          {path.status === "connected" ? (
            <>
              {path.routes.length > 1 ? <p className="zq-meta">{t.routesNote}</p> : null}
              <p id="ln-graph-help" className="zq-meta zx-note">
                {t.graphHelp}
              </p>
              {path.routes.map((r, i) => (
                <section key={i} className="ln-route" aria-labelledby={`ln-route-${i}`} data-route={i + 1}>
                  <h2 id={`ln-route-${i}`} className="zq-eyebrow">
                    {t.routeTitle(i + 1, path.routes.length)}
                  </h2>
                  <p className="zq-meta" style={{ margin: 0 }} {...(r.traditions.length ? en : {})}>
                    {r.traditions.length ? t.routeTradition(r.traditions.join(", ")) : t.routeNoTradition}
                  </p>
                  <RouteGraph route={r} enabled={enabled} nameOf={nameOf} selected={sel} onSelect={select} />
                  <h3 className="zq-eyebrow">{t.outlineTitle}</h3>
                  <p className="zq-meta" style={{ margin: 0 }}>
                    {t.outlineHelp}
                  </p>
                  <Outline route={r} doc={doc} enabled={enabled} nameOf={nameOf} onSelect={select} />
                </section>
              ))}
            </>
          ) : (
            <section className="ln-route" aria-labelledby="ln-gapstate-h">
              <h2 id="ln-gapstate-h">
                {path.status === "incompatible" ? t.incompatibleTitle : path.status === "missing_endpoint" ? t.missingEndsTitle : t.notConnectedTitle}
              </h2>
              <p>{path.status === "incompatible" ? t.incompatibleBody : path.status === "missing_endpoint" ? t.missingEndsBody : t.notConnectedBody}</p>
              {path.status === "incompatible"
                ? path.incompatible.map((r, i) => (
                    <div key={i}>
                      <p className="zq-meta" {...en}>
                        {t.incompatibleRoute(r.traditions.join(", "))}
                      </p>
                      <Outline route={r} doc={doc} enabled={enabled} nameOf={nameOf} onSelect={select} />
                    </div>
                  ))
                : null}
              {path.status === "not_connected" ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {([[t.fromStartTitle(nameOf(start)), path.fromStart], [t.toEndTitle(nameOf(end)), path.toEnd]] as const).map(([title, ids]) => (
                    <section key={title} aria-label={title}>
                      <h3 className="zq-eyebrow">{title}</h3>
                      {ids.length ? (
                        <ul className="ln-refs">
                          {ids.map((id) => (
                            <li key={id}>
                              <button type="button" className="zq-btn zq-btn-secondary ln-btn" onClick={() => select({ kind: "person", id })} {...en}>
                                {nameOf(id)}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>{t.nobody}</p>
                      )}
                    </section>
                  ))}
                </div>
              ) : null}
            </section>
          )}

          <AssessmentPanel ref={panel} doc={doc} sel={sel} nameOf={nameOf} onClear={() => setSel(null)} />
          <LineageCountsList counts={counts} />
        </>
      )}
      <p>
        <Link href="/scriptures">{t.aboutScriptures}</Link>
      </p>
    </div>
  );
}
