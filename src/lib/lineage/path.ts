import type { LineageDoc, LineagePath, Route, RouteOption, RouteStep } from "./types";

/** The two ends of the lineage view (people slugs). */
export const LINEAGE_START = "adam";
export const LINEAGE_END = "muhammad";

interface Edge {
  to: string;
  options: RouteOption[];
}

/**
 * The route(s) from `start` to `end` through PUBLISHED links and gaps only. Nothing is invented: if the published rows
 * do not connect the two, the status says so ("not_connected") and lists what IS established from each end.
 *
 * A route is a chain of steps; a step is a pair of people with every published way the sources connect them (a link or
 * an "undocumented generations" gap; competing options are kept together). A route is only shown as one chain when a
 * single tradition (or none) can carry it from end to end: a chain assembled from incompatible traditions is returned
 * under `incompatible` and is never presented as the path.
 */
export function findLineagePath(doc: LineageDoc, start = LINEAGE_START, end = LINEAGE_END, opts: { maxRoutes?: number; maxVisits?: number } = {}): LineagePath {
  const maxRoutes = opts.maxRoutes ?? 6;
  const maxVisits = opts.maxVisits ?? 20000;
  const known = new Set(doc.people.map((p) => p.id));
  const empty = (status: LineagePath["status"]): LineagePath => ({ status, start, end, routes: [], incompatible: [], fromStart: [], toEnd: [] });
  if (!known.has(start) || !known.has(end) || start === end) return empty("missing_endpoint");

  const down = new Map<string, Map<string, RouteOption[]>>();
  const up = new Map<string, Set<string>>();
  const add = (a: string, d: string, o: RouteOption) => {
    if (!known.has(a) || !known.has(d) || a === d) return;
    let m = down.get(a);
    if (!m) down.set(a, (m = new Map()));
    m.set(d, [...(m.get(d) ?? []), o]);
    let s = up.get(d);
    if (!s) up.set(d, (s = new Set()));
    s.add(a);
  };
  for (const l of doc.links) add(l.ancestor, l.descendant, { type: "link", id: l.id, evidenceClass: l.evidenceClass, tradition: l.tradition, competingGroup: l.competingGroup });
  for (const g of doc.gaps) add(g.ancestor, g.descendant, { type: "gap", id: g.id, evidenceClass: g.evidenceClass, tradition: g.tradition, competingGroup: g.competingGroup });

  const edges = (id: string): Edge[] =>
    [...(down.get(id) ?? new Map<string, RouteOption[]>()).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([to, options]) => ({ to, options }));

  // Every simple route, depth first, bounded (a lineage is a handful of competing routes, not thousands).
  const found: RouteStep[][] = [];
  let visits = 0;
  const walk = (at: string, seen: Set<string>, steps: RouteStep[]) => {
    if (visits++ > maxVisits) return;
    if (at === end) {
      found.push(steps);
      return;
    }
    for (const e of edges(at)) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      walk(e.to, seen, [...steps, { ancestor: at, descendant: e.to, options: e.options }]);
      seen.delete(e.to);
    }
  };
  walk(start, new Set([start]), []);
  found.sort((a, b) => a.length - b.length || a.map((s) => s.descendant).join(">").localeCompare(b.map((s) => s.descendant).join(">")));

  const routes: Route[] = [];
  const incompatible: Route[] = [];
  for (const steps of found) {
    const named = [...new Set(steps.flatMap((s) => s.options.map((o) => o.tradition).filter((t): t is string => !!t)))].sort();
    const carriers = named.length === 0 ? [] : named.filter((t) => steps.every((s) => s.options.some((o) => o.tradition === null || o.tradition === t)));
    if (named.length === 0 || carriers.length > 0) {
      if (routes.length < maxRoutes) routes.push({ steps, traditions: carriers });
    } else if (incompatible.length < maxRoutes) incompatible.push({ steps, traditions: named });
  }

  const reach = (from: string, next: (id: string) => Iterable<string>) => {
    const seen = new Set<string>();
    const queue = [from];
    while (queue.length) {
      const at = queue.shift()!;
      for (const n of next(at)) {
        if (seen.has(n) || n === from) continue;
        seen.add(n);
        queue.push(n);
      }
    }
    return [...seen].sort();
  };
  return {
    status: routes.length ? "connected" : incompatible.length ? "incompatible" : "not_connected",
    start,
    end,
    routes,
    incompatible,
    fromStart: reach(start, (id) => down.get(id)?.keys() ?? []),
    toEnd: reach(end, (id) => up.get(id) ?? []),
  };
}
