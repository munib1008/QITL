import type { Route, RouteOption } from "./types";

export const NODE_W = 210;
export const NODE_H = 48;
export const TOP = 24;
const STEP_PLAIN = 108;
const STEP_GAP = 160;
const SPREAD = 170;
export const TAG_W = 104;
export const TAG_H = 26;
export const GAP_W = 176;
export const GAP_H = 54;

export interface LaidOption {
  option: RouteOption;
  /** Where the line bulges to (its x at mid height) and where its tag or gap box is centred. */
  x: number;
  midX: number;
  midY: number;
  /** Path from the upper person's bottom edge to the lower person's top edge. */
  d: string;
  visible: boolean;
}
export interface LaidStep {
  index: number;
  ancestor: string;
  descendant: string;
  y1: number;
  y2: number;
  options: LaidOption[];
  hidden: number;
}
export interface LaidRoute {
  width: number;
  height: number;
  cx: number;
  persons: Array<{ id: string; x: number; y: number }>;
  steps: LaidStep[];
}

/**
 * A vertical chain: the earliest person at the top, each later person below, every step drawn as one line per published
 * account (competing accounts side by side). A step that holds a gap leaves room for its box. Options hidden by the
 * evidence filter are kept in the layout (so the chain does not jump) and flagged invisible.
 */
export function layoutRoute(route: Route, isVisible: (o: RouteOption) => boolean): LaidRoute {
  const maxN = Math.max(1, ...route.steps.map((s) => s.options.length));
  const spacing = maxN > 1 ? Math.min(SPREAD, 560 / maxN) : 0;
  const width = Math.max(NODE_W + 80, (maxN - 1) * spacing + GAP_W + 40);
  const cx = width / 2;
  const persons: LaidRoute["persons"] = [];
  const steps: LaidStep[] = [];
  let y = TOP + NODE_H / 2;
  persons.push({ id: route.steps[0]!.ancestor, x: cx, y });
  route.steps.forEach((s, index) => {
    const hasGap = s.options.some((o) => o.type === "gap");
    const stepH = hasGap ? STEP_GAP : STEP_PLAIN;
    const y1 = y + NODE_H / 2;
    const y2 = y + stepH - NODE_H / 2;
    const n = s.options.length;
    const options = s.options.map((option, i) => {
      const x = cx + (i - (n - 1) / 2) * spacing;
      const d = n === 1 ? `M${cx} ${y1} L${cx} ${y2}` : `M${cx} ${y1} C${x} ${y1 + (y2 - y1) * 0.35} ${x} ${y2 - (y2 - y1) * 0.35} ${cx} ${y2}`;
      return { option, x, midX: n === 1 ? cx : 0.25 * cx + 0.75 * x, midY: (y1 + y2) / 2, d, visible: isVisible(option) };
    });
    steps.push({ index, ancestor: s.ancestor, descendant: s.descendant, y1, y2, options, hidden: options.filter((o) => !o.visible).length });
    y += stepH;
    persons.push({ id: s.descendant, x: cx, y });
  });
  return { width, height: y + NODE_H / 2 + TOP, cx, persons, steps };
}

/** Break a label into at most two lines near its middle, for SVG text that cannot wrap by itself. */
export function splitLabel(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const mid = Math.floor(text.length / 2);
  const before = text.lastIndexOf(" ", mid);
  const after = text.indexOf(" ", mid);
  const at = before < 0 ? after : after < 0 ? before : mid - before <= after - mid ? before : after;
  if (at < 0) return [text.slice(0, max - 1) + "…"];
  const a = text.slice(0, at);
  const b = text.slice(at + 1);
  return [a.length > max ? a.slice(0, max - 1) + "…" : a, b.length > max ? b.slice(0, max - 1) + "…" : b];
}
