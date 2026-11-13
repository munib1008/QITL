import { describe, expect, it } from "vitest";
import { loadTokens } from "../../scripts/build-tokens";

/**
 * Palette guard. The interface is paper + graphite + ink plus ONE accent (#0b5560, #6fbac4 on dark). The accent is for
 * the primary action, the current/active item, progress fill and the focus ring. Evidence and status colours are the
 * only other hues. Any new colour token must be added to a group below on purpose, and a new hue fails this test.
 */
const PAPER = ["surface", "surface-raised", "surface-sunken", "q-bg", "q-surface", "q-surface-2", "q-surface-3", "hairline", "q-line", "q-line-2", "sage", "sage-soft", "glass-fill", "glass-fill-strong", "glass-stroke", "glass-highlight", "scrim"];
const GRAPHITE = ["brass", "brass-ink", "slate", "border", "q-mark", "q-text-3", "glow-gold"];
const INK = ["ink", "ink-muted", "ink-inverse", "sage-ink", "q-text", "q-text-2"];
const ACCENT = ["accent", "accent-soft", "on-accent", "brand", "brand-deep", "on-brand", "on-brand-deep", "surface-inverse", "focus", "glow-emerald", "glow-teal", "glow-cyan", "map-point", "map-region", "map-route", "map-hypothesis"];
const EVIDENCE = ["ev-quran", "ev-hadith", "ev-scholar", "ev-estimate", "ev-disputed", "ev-unknown"];
const STATUS = ["status-info", "status-success", "status-warning", "status-danger"];
const ALLOWED = new Set([...PAPER, ...GRAPHITE, ...INK, ...ACCENT, ...EVIDENCE, ...STATUS]);
const THEMES = ["light", "dark", "journey"] as const;

const tokens = loadTokens();
const colour = tokens.color.tokens;
const byName = new Map(colour.map((t) => [t.name, t]));

function value(name: string, theme: string): string {
  const t = byName.get(name);
  if (!t) throw new Error(`no colour token ${name}`);
  const raw = typeof t.value === "string" ? t.value : t.value[theme];
  const ref = /^\{(.+)\}$/.exec(raw);
  return ref ? value(ref[1], theme) : raw;
}
function rgb(v: string): [number, number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as [number, number, number, number];
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/.exec(v);
  if (!m) throw new Error(`unparseable colour ${v}`);
  return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
}
const lum = ([r, g, b]: number[]) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(rgb(a)), lum(rgb(b))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** The design's greys are slightly warm (channel spread up to 6); anything beyond 8 is a real hue. */
const isNeutral = ([r, g, b]: number[]) => Math.max(r, g, b) - Math.min(r, g, b) <= 8;
/** The accent family: hue within the teal band of #0b5560 / #6fbac4. */
function isAccentHue([r, g, b]: number[]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return true;
  const d = max - min;
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60 >= 170 && h * 60 <= 200;
}

describe("palette guard", () => {
  it("every colour token belongs to paper, graphite, ink, accent, evidence or status", () => {
    const stray = colour.map((t) => t.name).filter((n) => !ALLOWED.has(n));
    expect(stray, `colour tokens outside the allowed groups: ${stray.join(", ")}`).toEqual([]);
  });

  it("paper, graphite and ink are neutral greys (no hue)", () => {
    const bad: string[] = [];
    for (const n of [...PAPER, ...GRAPHITE, ...INK]) for (const th of THEMES) {
      if (n === "scrim" || n.startsWith("glass-")) continue; // alpha overlays of the same neutrals
      if (!isNeutral(rgb(value(n, th)))) bad.push(`${n}[${th}]=${value(n, th)}`);
    }
    expect(bad).toEqual([]);
  });

  it("accent tokens stay in the teal family, and the accent is #0b5560 on light", () => {
    expect(value("accent", "light").toLowerCase()).toBe("#0b5560");
    const bad: string[] = [];
    for (const n of ACCENT) for (const th of THEMES) {
      const c = rgb(value(n, th));
      if (n === "on-accent" || n === "on-brand" || n === "on-brand-deep") continue; // text on the accent: neutral
      if (!isAccentHue(c) && !isNeutral(c)) bad.push(`${n}[${th}]=${value(n, th)}`);
    }
    expect(bad).toEqual([]);
  });

  it("no gold, brass-yellow or other warm decoration outside the evidence/status colours", () => {
    const bad: string[] = [];
    for (const n of colour.map((t) => t.name)) {
      if (EVIDENCE.includes(n) || STATUS.includes(n)) continue;
      for (const th of THEMES) {
        const c = rgb(value(n, th));
        if (!isNeutral(c) && !isAccentHue(c)) bad.push(`${n}[${th}]=${value(n, th)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("WCAG contrast of the token pairs", () => {
  const surfaces = ["surface", "surface-raised", "surface-sunken"];
  const text = ["ink", "ink-muted", "brass-ink", "slate", "brand", "ev-quran", "ev-hadith", "ev-scholar", "ev-estimate", "ev-disputed", "ev-unknown", "status-info", "status-success", "status-warning", "status-danger"];
  for (const th of ["light", "dark"] as const) {
    it(`${th}: body, muted, accent, evidence and status text reach 4.5:1 on every surface`, () => {
      const low: string[] = [];
      for (const s of surfaces) for (const n of text) {
        const c = contrast(value(n, th), value(s, th));
        if (c < 4.5) low.push(`${n} on ${s}: ${c.toFixed(2)}`);
      }
      expect(low).toEqual([]);
    });
    it(`${th}: focus ring and component borders reach 3:1 on the page surface`, () => {
      expect(contrast(value("focus", th), value("surface", th))).toBeGreaterThanOrEqual(3);
      expect(contrast(value("border", th), value("surface", th))).toBeGreaterThanOrEqual(3);
    });
    it(`${th}: text on the accent reaches 4.5:1`, () => {
      expect(contrast(value("on-brand", th), value("brand", th))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(value("on-brand-deep", th), value("brand-deep", th))).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("elevation and motion tokens", () => {
  it("defines elevation e0 to e4 and the motion set", () => {
    const sh = tokens.shadow.tokens.map((t) => t.name);
    for (const e of ["e0", "e1", "e2", "e3", "e4"]) expect(sh).toContain(`shadow-${e}`);
    const m = tokens.motion?.tokens.map((t) => t.name) ?? [];
    for (const n of ["dur-instant", "dur-fast", "dur-base", "dur-slow", "ease-standard", "press-scale", "hover-lift"]) expect(m).toContain(n);
  });
});
