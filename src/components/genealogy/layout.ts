import type { GenealogyGraph } from "./types";

export const NODE_W = 136;
export const NODE_H = 52;
const DX = 164;
const DY = 124;
const PAD = 40;

export interface PlacedNode {
  id: string;
  name: string;
  level: number;
  x: number;
  y: number;
}
export interface GraphLayout {
  nodes: Map<string, PlacedNode>;
  /** Hidden because a branch above them is collapsed. */
  hidden: Set<string>;
  /** For each collapsed person, how many people their collapsed branch hides. */
  hiddenBelow: Map<string, number>;
  width: number;
  height: number;
}

/** Children of a person: parent_of from → to, and descendant_of to ← from. */
export function childrenOf(g: GenealogyGraph, id: string): string[] {
  return g.edges.flatMap((e) => (e.kind === "parent_of" && e.from === id ? [e.to] : e.kind === "descendant_of" && e.to === id ? [e.from] : []));
}

/**
 * Generations relative to the centre person: parents one row up, children one row down, spouses and siblings on the
 * same row. Rows are drawn in breadth-first order from the centre. Nothing is inferred beyond the edges given.
 */
export function generations(g: GenealogyGraph): Map<string, number> {
  const adj = new Map<string, Array<[string, number]>>();
  const add = (a: string, b: string, d: number) => adj.set(a, [...(adj.get(a) ?? []), [b, d]]);
  for (const e of g.edges) {
    const d = e.kind === "parent_of" ? 1 : e.kind === "descendant_of" ? -1 : 0;
    add(e.from, e.to, d);
    add(e.to, e.from, -d);
  }
  const level = new Map<string, number>();
  const starts = [g.focus, ...g.nodes.map((n) => n.id)];
  for (const s of starts) {
    if (level.has(s) || !g.nodes.some((n) => n.id === s)) continue;
    level.set(s, 0);
    const q = [s];
    while (q.length) {
      const a = q.shift()!;
      for (const [b, d] of adj.get(a) ?? []) {
        if (level.has(b)) continue;
        level.set(b, level.get(a)! + d);
        q.push(b);
      }
    }
  }
  return level;
}

export function layoutGraph(g: GenealogyGraph, collapsed: ReadonlySet<string>, rtl = false): GraphLayout {
  const level = generations(g);
  const hidden = new Set<string>();
  const hiddenBelow = new Map<string, number>();
  for (const c of collapsed) {
    const seen = new Set<string>();
    const stack = childrenOf(g, c);
    while (stack.length) {
      const n = stack.pop()!;
      if (seen.has(n) || n === c || n === g.focus) continue;
      seen.add(n);
      stack.push(...childrenOf(g, n));
    }
    hiddenBelow.set(c, seen.size);
    for (const n of seen) hidden.add(n);
  }
  const order = [...level.keys()];
  const rows = new Map<number, string[]>();
  for (const id of order) {
    if (hidden.has(id)) continue;
    const l = level.get(id)!;
    rows.set(l, [...(rows.get(l) ?? []), id]);
  }
  const levels = [...rows.keys()].sort((a, b) => a - b);
  const widest = Math.max(1, ...[...rows.values()].map((r) => r.length));
  const width = PAD * 2 + widest * DX;
  const height = PAD * 2 + Math.max(0, levels.length - 1) * DY + NODE_H;
  const nodes = new Map<string, PlacedNode>();
  levels.forEach((l, li) => {
    const row = rows.get(l)!;
    const x0 = (width - row.length * DX) / 2 + DX / 2;
    row.forEach((id, i) => {
      const x = x0 + i * DX;
      nodes.set(id, { id, name: g.nodes.find((n) => n.id === id)?.name ?? id, level: l, x: rtl ? width - x : x, y: PAD + NODE_H / 2 + li * DY });
    });
  });
  return { nodes, hidden, hiddenBelow, width, height };
}
