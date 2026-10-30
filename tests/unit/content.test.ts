import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import raw from "../../content/journey/journey.draft.json";
import { findStop, getJourney, journeyStops, parseJourney } from "@/content/journey";
import { matchesFilter } from "@/components/journey/JourneyTimeline";
import { buildCss, loadTokens } from "../../scripts/build-tokens";
import { journeyTimeline, todayLabel } from "@/lib/timeline";

describe("tokens", () => {
  test("every token in tokens.json is present in the generated CSS", () => {
    const t = loadTokens();
    const css = readFileSync("src/styles/tokens.css", "utf8");
    const names = [
      ...t.color.tokens,
      ...t.shadow.tokens,
      ...t.spacing.tokens,
      ...t.radius.tokens,
      ...t.breakpoint.tokens,
      ...t.size.tokens,
      ...t.zIndex.tokens,
    ].map((x) => `--${x.name}:`);
    for (const n of names) expect(css, n).toContain(n);
    for (const theme of ["light", "dark", "journey"]) expect(css).toContain(`[data-theme="${theme}"]`);
    for (const f of Object.keys(t.type.families)) expect(css).toContain(`--font-${f}:`);
  });
  test("the generated CSS is up to date with tokens.json", () => {
    expect(readFileSync("src/styles/tokens.css", "utf8")).toBe(buildCss(loadTokens()));
  });
});

describe("journey content", () => {
  const j = getJourney();
  const stops = journeyStops(j);

  test("validates as ziq.journey.v1 and is marked draft", () => {
    expect(j.schema).toBe("ziq.journey.v1");
    expect(j.status).toBe("draft");
  });

  test("has 29 stops in order: Adam … Isa, Muhammad ﷺ, then five milestones", () => {
    expect(stops).toHaveLength(29);
    expect(stops[0]!.id).toBe("adam");
    expect(stops.map((s) => s.id).slice(-7)).toEqual(["isa", "muhammad", "birth", "revelation", "hijrah", "farewell", "passing"]);
    expect(stops.map((s) => Number(s.chapter))).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
  });

  test("filters: 24 prophet cards (Musa & Harun together), 5 key events", () => {
    expect(stops.filter((s) => matchesFilter(s, "prophet"))).toHaveLength(24);
    expect(stops.filter((s) => matchesFilter(s, "milestone"))).toHaveLength(5);
    expect(stops.filter((s) => matchesFilter(s, "all"))).toHaveLength(29);
    expect(stops.filter((s) => matchesFilter(s, "prophet")).reduce((n, s) => n + s.name.split(" & ").length, 0)).toBe(25);
  });

  test("no stop before Muhammad ﷺ shows a CE/BCE year unless it is labelled a historians' estimate", () => {
    const before = stops.slice(0, stops.findIndex((s) => s.id === "muhammad"));
    for (const s of before) {
      const hasYear = /\b(BCE|CE|\d{3,4})\b/.test(s.era.label);
      if (hasYear) expect(s.era.certainty, s.id).toBe("estimate");
    }
  });

  test("unknown places are never given coordinates", () => {
    const text = JSON.stringify(raw);
    expect(text).not.toMatch(/"(lat|lng|lon|latitude|longitude|coordinates)"/i);
  });

  test("a schema error fails loudly", () => {
    const broken = structuredClone(raw) as { eras: Array<{ items: Array<{ era: { certainty: string } }> }> };
    broken.eras[0]!.items[0]!.era.certainty = "probably";
    expect(() => parseJourney(broken)).toThrow(/ziq.journey.v1/);
  });

  test("Yusuf is chapter 11 of 29 between Yaqub and Ayyub, with 8 story steps", () => {
    const p = findStop("yusuf")!;
    expect(p.index + 1).toBe(11);
    expect(p.total).toBe(29);
    expect(p.prev?.id).toBe("yaqub");
    expect(p.next?.id).toBe("ayyub");
    expect(p.item.story).toHaveLength(8);
  });
});

describe("timeline", () => {
  test("relative eras carry no years, and the break sits after the last relative era", () => {
    const eras = journeyTimeline(getJourney());
    for (const e of eras.filter((e) => e.kind === "relative"))
      for (const it of e.items) if (it.precision === "relative") expect(it.dateLabel).toBe("Relative order only");
    const lastRel = eras.map((e) => e.kind).lastIndexOf("relative");
    expect(eras[lastRel]!.breakAfter).toBeTruthy();
    expect(eras.filter((e) => e.breakAfter)).toHaveLength(1);
    expect(eras.at(-1)!.kind).toBe("dated");
  });
  test("today shows CE and AH", () => {
    expect(todayLabel(new Date("2026-10-30T00:00:00Z"))).toMatch(/^2026 CE · 14\d\d AH$/);
  });
});
