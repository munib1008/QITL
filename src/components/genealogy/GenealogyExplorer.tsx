"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { EvidenceLabel } from "@/components/ui/evidence";
import { usePanZoom, ZoomControls, type Size } from "@/components/ui/panzoom";
import { childrenOf, layoutGraph, NODE_H, NODE_W } from "./layout";
import { lineStatus, type GenealogyGraph } from "./types";
import { genealogyStrings } from "@/lib/i18n/modules/atlas";
import { useLocale } from "@/lib/i18n/useLocale";

type G = ReturnType<typeof genealogyStrings>;

/** How an edge reads from the selected person's side. */
function relationFrom(kind: string, selIsFrom: boolean, t: G): string {
  if (kind === "parent_of") return selIsFrom ? t.relFrom.parent_of : t.relFrom.child_of;
  if (kind === "descendant_of") return selIsFrom ? t.relFrom.descendant_of : t.relFrom.ancestor_of;
  if (kind === "spouse_of") return t.relFrom.spouse_of;
  if (kind === "sibling_of") return t.relFrom.sibling_of;
  return kind.replace(/_/g, " ");
}

/**
 * The family graph around one person: pan and pinch-zoom, tap a person to focus them (their direct links are
 * listed, the rest can be hidden), collapse and expand the branch below anyone. Established, disputed and unknown
 * lines keep distinct strokes and words. The relationship list on the page is the text alternative.
 */
export function GenealogyExplorer({ graph, centerable, rtl = false }: { graph: GenealogyGraph; centerable: string[]; rtl?: boolean }) {
  const t = genealogyStrings(useLocale());
  const [selected, setSelected] = useState(graph.focus);
  const [only, setOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const layout = useMemo(() => layoutGraph(graph, collapsed, rtl), [graph, collapsed, rtl]);
  const content: Size = useMemo(() => ({ w: layout.width, h: layout.height }), [layout.width, layout.height]);
  const name = useCallback((id: string) => graph.nodes.find((n) => n.id === id)?.name ?? id, [graph.nodes]);

  const adjacent = useMemo(() => {
    const s = new Set([selected]);
    for (const e of graph.edges) {
      if (e.from === selected) s.add(e.to);
      if (e.to === selected) s.add(e.from);
    }
    return s;
  }, [graph.edges, selected]);
  const shown = (id: string) => layout.nodes.has(id) && (!only || adjacent.has(id));

  const initial = useCallback(
    (vp: Size) => {
      const s = vp.w >= 900 ? Math.max(0.6, Math.min(1, vp.w / content.w)) : 1;
      const f = layout.nodes.get(graph.focus);
      return { s, x: f ? vp.w / 2 - f.x * s : (vp.w - content.w * s) / 2, y: f ? Math.min(24, vp.h / 2 - f.y * s) : 24 };
    },
    [content.w, layout.nodes, graph.focus],
  );
  const pz = usePanZoom({ content, initial, min: 0.4, max: 2.5, ssrViewport: { w: 360, h: 380 } });
  const { centerOn } = pz;

  // Keep the focused person on screen when the focus changes or the drawing is re-laid out.
  useEffect(() => {
    const n = layout.nodes.get(selected);
    if (n && only) centerOn(n.x, n.y);
  }, [selected, only, layout, centerOn]);

  const select = (id: string) => setSelected(id);
  const onNodeKey = (id: string) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(id);
    }
  };

  const selEdges = graph.edges.filter((e) => e.from === selected || e.to === selected);
  const hasBranch = childrenOf(graph, selected).length > 0;
  const isCollapsed = collapsed.has(selected);
  const toggleBranch = () =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(selected)) n.delete(selected);
      else n.add(selected);
      return n;
    });

  return (
    <div className="zg">
      <p id="zg-help" className="zq-meta zx-note">
        {t.help}
      </p>
      <div className="zx-stage">
        <div
          ref={pz.ref}
          className="zx-viewport"
          tabIndex={0}
          role="group"
          aria-label={t.graph}
          aria-describedby="zg-help"
          data-scale={pz.view.s.toFixed(3)}
          data-x={pz.view.x.toFixed(1)}
          {...pz.handlers}
        >
          <svg className="zx-svg" width="100%" height="100%" role="group" aria-label={t.graphAround(name(graph.focus))}>
            <g transform={pz.transform}>
              {graph.edges.map((e) => {
                const a = layout.nodes.get(e.from);
                const b = layout.nodes.get(e.to);
                if (!a || !b || !shown(e.from) || !shown(e.to)) return null;
                const st = lineStatus(e.confidence);
                const vertical = a.level !== b.level;
                const [top, bot] = a.y < b.y ? [a, b] : [b, a];
                let d: string;
                let lx: number;
                let ly: number;
                if (vertical) {
                  const y1 = top.y + NODE_H / 2;
                  const y2 = bot.y - NODE_H / 2;
                  const my = (y1 + y2) / 2;
                  d = `M${top.x} ${y1} C${top.x} ${my} ${bot.x} ${my} ${bot.x} ${y2}`;
                  lx = (top.x + bot.x) / 2;
                  ly = my;
                } else {
                  const [l, r] = a.x < b.x ? [a, b] : [b, a];
                  const adjacentBoxes = r.x - l.x <= NODE_W + 40;
                  if (adjacentBoxes) {
                    d = `M${l.x + NODE_W / 2} ${l.y} L${r.x - NODE_W / 2} ${r.y}`;
                    ly = l.y - 8;
                  } else {
                    const h = l.y - NODE_H / 2;
                    d = `M${l.x} ${h} Q${(l.x + r.x) / 2} ${h - 46} ${r.x} ${h}`;
                    ly = h - 26;
                  }
                  lx = (l.x + r.x) / 2;
                }
                const dim = !adjacent.has(e.from) || !adjacent.has(e.to);
                const word = st === "verified" ? (vertical ? "" : e.kind === "spouse_of" ? "spouse" : e.kind === "sibling_of" ? "sibling" : "") : st;
                return (
                  <g key={e.id} className={dim && selected !== graph.focus ? "zg-dim" : undefined} data-edge={st} aria-hidden="true">
                    {st === "disputed" ? (
                      <>
                        <path d={d} className="zg-e zg-e-disputed-o" />
                        <path d={d} className="zg-e zg-e-disputed-i" />
                      </>
                    ) : (
                      <path d={d} className={`zg-e zg-e-${st}`} />
                    )}
                    {word ? (
                      <text x={lx} y={ly} textAnchor="middle" className="zg-e-label">
                        {word}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {[...layout.nodes.values()].map((n) => {
                if (!shown(n.id)) return null;
                const links = graph.edges.filter((e) => e.from === n.id || e.to === n.id).length;
                const hiddenBelow = layout.hiddenBelow.get(n.id) ?? 0;
                const label = n.name.length > 16 ? `${n.name.slice(0, 15)}…` : n.name;
                return (
                  <g
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    className="zg-node"
                    data-person={n.id}
                    data-center={n.id === graph.focus || undefined}
                    aria-pressed={n.id === selected}
                    aria-label={`${n.name}. ${links} ${links === 1 ? "link" : "links"}${n.id === graph.focus ? ". Centre of the graph" : ""}${hiddenBelow ? `. Branch collapsed, ${hiddenBelow} hidden` : ""}`}
                    onClick={() => select(n.id)}
                    onKeyDown={onNodeKey(n.id)}
                  >
                    <rect x={n.x - NODE_W / 2} y={n.y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={12} className="zg-box" />
                    <text x={n.x} y={n.y + (hiddenBelow ? -2 : 5)} textAnchor="middle" className="zg-name">
                      {label}
                    </text>
                    {hiddenBelow ? (
                      <text x={n.x} y={n.y + 16} textAnchor="middle" className="zg-badge">
                        {t.hiddenBelow(hiddenBelow)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
        <ZoomControls label={t.zoom} view={pz.view} min={pz.min} max={pz.max} onIn={() => pz.zoomBy(1.25)} onOut={() => pz.zoomBy(0.8)} onReset={pz.reset} />
      </div>

      <section className="zg-panel" aria-labelledby="zg-sel-h" data-selected={selected}>
        <p className="zq-eyebrow">{t.focused}</p>
        <h3 id="zg-sel-h">{name(selected)}</h3>
        {selEdges.length ? (
          <ul aria-label={t.directLinks(name(selected))}>
            {selEdges.map((e) => {
              const st = lineStatus(e.confidence);
              const other = e.from === selected ? e.to : e.from;
              return (
                <li key={e.id}>
                  <span>
                    {relationFrom(e.kind, e.from === selected, t)}{" "}
                    <button type="button" className="zq-btn zq-btn-quiet" onClick={() => select(other)}>
                      {name(other)}
                    </button>
                  </span>
                  <EvidenceLabel kind={st === "verified" ? "scholar" : st}>{t.lines[st]}</EvidenceLabel>
                  {e.competingGroup ? <span className="zq-meta">{t.competing}</span> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="zq-meta">{t.noneHere}</p>
        )}
        <div className="zg-acts">
          <button type="button" className="zq-btn zq-btn-secondary" aria-pressed={only} onClick={() => setOnly((o) => !o)}>
            {only ? t.showEveryone : t.showOnly(name(selected))}
          </button>
          {hasBranch || isCollapsed ? (
            <button type="button" className="zq-btn zq-btn-secondary" aria-expanded={!isCollapsed} onClick={toggleBranch}>
              {isCollapsed ? t.expandBranch(name(selected)) : t.collapseBranch(name(selected))}
            </button>
          ) : null}
          {collapsed.size > (isCollapsed ? 1 : 0) ? (
            <button type="button" className="zq-btn zq-btn-quiet" onClick={() => setCollapsed(new Set())}>
              {t.expandAll}
            </button>
          ) : null}
          {selected !== graph.focus && centerable.includes(selected) ? (
            <Link className="zq-btn zq-btn-quiet" href={`/genealogy?focus=${selected}`}>
              {t.centreOn(name(selected))}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
