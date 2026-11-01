"use client";

import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePanZoom, ZoomControls, type Size } from "@/components/ui/panzoom";
import { lineStyleFor } from "@/lib/lineage/classes";
import { GAP_H, GAP_W, layoutRoute, NODE_H, NODE_W, splitLabel, TAG_H, TAG_W } from "@/lib/lineage/layout";
import type { LineageClass } from "@/lib/lineage/classes";
import type { Route, RouteOption } from "@/lib/lineage/types";
import { lineageStrings } from "@/lib/i18n/modules/lineage";
import { useLocale } from "@/lib/i18n/useLocale";
import type { Selection } from "./AssessmentPanel";

interface Item {
  key: string;
  kind: "person" | "link" | "gap";
  id: string;
}

/**
 * One route as a vertical chain with pan and pinch-zoom. Each person is a box; each published account of a step is a
 * line whose pattern, colour AND tag text give its evidence class; an undocumented stretch is a dashed "gap" box.
 * Keyboard: Tab enters the chain, Arrow Up/Down (or Home/End) move along it, Enter or Space assesses the item.
 * The text outline next to the graph is the accessible alternative with the same content.
 */
export function RouteGraph({
  route,
  enabled,
  nameOf,
  selected,
  onSelect,
}: {
  route: Route;
  enabled: ReadonlySet<LineageClass>;
  nameOf: (id: string) => string;
  selected: Selection;
  onSelect: (s: Selection) => void;
}) {
  const t = lineageStrings(useLocale());
  const isVisible = useCallback((o: RouteOption) => enabled.has(o.evidenceClass), [enabled]);
  const lay = useMemo(() => layoutRoute(route, isVisible), [route, isVisible]);
  const content: Size = useMemo(() => ({ w: lay.width, h: lay.height }), [lay.width, lay.height]);
  const initial = useCallback((vp: Size) => {
    const s = Math.min(1, vp.w / content.w);
    return { s, x: (vp.w - content.w * s) / 2, y: 8 };
  }, [content.w]);
  const pz = usePanZoom({ content, initial, min: 0.4, max: 2.5, ssrViewport: { w: 360, h: 420 } });

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [{ key: `p-${lay.persons[0]!.id}`, kind: "person", id: lay.persons[0]!.id }];
    lay.steps.forEach((s, i) => {
      for (const o of s.options) if (o.visible) out.push({ key: `o-${o.option.id}`, kind: o.option.type, id: o.option.id });
      out.push({ key: `p-${s.descendant}-${i}`, kind: "person", id: s.descendant });
    });
    return out;
  }, [lay]);
  const [rov, setRov] = useState(items[0]!.key);
  const refs = useRef(new Map<string, SVGGElement>());
  const setRef = (key: string) => (el: SVGGElement | null) => {
    if (el) refs.current.set(key, el);
    else refs.current.delete(key);
  };
  const move = (to: number) => {
    const i = Math.max(0, Math.min(items.length - 1, to));
    const next = items[i]!;
    setRov(next.key);
    refs.current.get(next.key)?.focus();
  };
  const onKey = (item: Item) => (e: KeyboardEvent) => {
    const i = items.findIndex((x) => x.key === item.key);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect({ kind: item.kind, id: item.id });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      move(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(items.length - 1);
    }
  };
  const isSel = (kind: Item["kind"], id: string) => selected?.kind === kind && selected.id === id;
  const label = (n: string, max = 26) => (n.length > max ? `${n.slice(0, max - 1)}…` : n);

  return (
    <div className="ln-graph zx-stage">
      <div ref={pz.ref} className="zx-viewport" tabIndex={0} role="group" aria-label={t.graphLabel(route.steps.length)} aria-describedby="ln-graph-help" data-scale={pz.view.s.toFixed(3)} {...pz.handlers}>
        <svg className="zx-svg" width="100%" height="100%" role="group" aria-label={t.graphLabel(route.steps.length)}>
          <g transform={pz.transform}>
            {lay.steps.map((s) => (
              <g key={`s-${s.index}`}>
                {s.options.map((o) => {
                  const cls = o.option.evidenceClass;
                  const { dasharray, pattern } = lineStyleFor(cls);
                  const k = `o-${o.option.id}`;
                  if (!o.visible) return <path key={k} d={o.d} className="ln-line" stroke="var(--hairline)" strokeDasharray="2 6" opacity={0.7} aria-hidden="true" />;
                  const gap = o.option.type === "gap";
                  const pressed = isSel(o.option.type, o.option.id);
                  const aria = `${gap ? t.gapTitle : t.linkWord}: ${t.outlineStep(nameOf(s.ancestor), nameOf(s.descendant))}. ${t.classes[cls].name}`;
                  const lines = gap ? splitLabel(t.gapTitle, 24) : [];
                  return (
                    <g
                      key={k}
                      ref={setRef(k)}
                      className="ln-opt"
                      role="button"
                      tabIndex={rov === k ? 0 : -1}
                      aria-pressed={pressed}
                      aria-label={aria}
                      data-class={cls}
                      data-pattern={pattern}
                      data-type={o.option.type}
                      onFocus={() => setRov(k)}
                      onClick={() => onSelect({ kind: o.option.type, id: o.option.id })}
                      onKeyDown={onKey({ key: k, kind: o.option.type, id: o.option.id })}
                    >
                      <path d={o.d} className="ln-line" data-class={cls} strokeDasharray={dasharray === "none" ? undefined : dasharray} />
                      {gap ? (
                        <>
                          <rect className="ln-gapbox" x={o.midX - GAP_W / 2} y={o.midY - GAP_H / 2 - 12} width={GAP_W} height={GAP_H} rx={10} />
                          {lines.map((l, i) => (
                            <text key={i} className="ln-gaptext" x={o.midX} y={o.midY - 12 - (lines.length === 1 ? -4 : 8) + i * 14}>
                              {l}
                            </text>
                          ))}
                          <rect className="ln-tag" data-class={cls} x={o.midX - TAG_W / 2} y={o.midY + GAP_H / 2 - 6} width={TAG_W} height={TAG_H} rx={13} />
                          <text className="ln-tag-text" data-class={cls} x={o.midX} y={o.midY + GAP_H / 2 + 11}>
                            {t.classes[cls].short}
                          </text>
                        </>
                      ) : (
                        <>
                          <rect className="ln-tag" data-class={cls} x={o.midX - TAG_W / 2} y={o.midY - TAG_H / 2} width={TAG_W} height={TAG_H} rx={13} />
                          <text className="ln-tag-text" data-class={cls} x={o.midX} y={o.midY + 4}>
                            {t.classes[cls].short}
                          </text>
                        </>
                      )}
                      <rect className="ln-hit" x={o.midX - Math.max(TAG_W, gap ? GAP_W : 0) / 2 - 4} y={o.midY - 26} width={Math.max(TAG_W, gap ? GAP_W : 0) + 8} height={gap ? GAP_H + 40 : 52} rx={12} />
                    </g>
                  );
                })}
                {s.hidden > 0 ? (
                  <text className="ln-gaptext" x={lay.cx + NODE_W / 2 + 8} y={(s.y1 + s.y2) / 2} textAnchor="start" fill="var(--ink-muted)">
                    {t.hiddenByFilter(s.hidden)}
                  </text>
                ) : null}
              </g>
            ))}
            {lay.persons.map((p, i) => {
              const k = i === 0 ? `p-${p.id}` : `p-${p.id}-${i - 1}`;
              const pressed = isSel("person", p.id);
              return (
                <g
                  key={k}
                  ref={setRef(k)}
                  className="ln-node"
                  role="button"
                  tabIndex={rov === k ? 0 : -1}
                  aria-pressed={pressed}
                  aria-label={nameOf(p.id)}
                  data-person={p.id}
                  onFocus={() => setRov(k)}
                  onClick={() => onSelect({ kind: "person", id: p.id })}
                  onKeyDown={onKey({ key: k, kind: "person", id: p.id })}
                >
                  <rect className="ln-box" x={p.x - NODE_W / 2} y={p.y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={12} />
                  <text className="ln-name" x={p.x} y={p.y + 5}>
                    {label(nameOf(p.id))}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <ZoomControls label={t.zoom} view={pz.view} min={pz.min} max={pz.max} onIn={() => pz.zoomBy(1.25)} onOut={() => pz.zoomBy(0.8)} onReset={pz.reset} />
    </div>
  );
}
