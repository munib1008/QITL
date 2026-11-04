import { describe, expect, test } from "vitest";
import inventory from "@content/events/inventory.draft.json";
import { draftLastHour, draftLineage, draftTimeline } from "@/content/draftAtlas";
import { draftDialNames } from "@/content/asmaDial";

/** The draft content behind the redesign views must keep the content rules of CLAUDE.md. */
describe("draft Complete Timeline content", () => {
  const t = draftTimeline();
  test("every inventory item is placed once, except the Last Hour sign shown on its own page", () => {
    const slugs = new Set(t.items.map((i) => i.slug));
    const missing = inventory.items.map((i) => i.slug).filter((s) => !slugs.has(s) && s !== "yajuj-and-majuj");
    expect(missing).toEqual([]);
    expect(slugs.has("yajuj-and-majuj")).toBe(false);
    expect(slugs.size).toBe(t.items.length);
  });
  test("an era is only a grouping: parables are never placed or dated, and only dated milestones carry a date", () => {
    for (const i of t.items) {
      if (i.track === "parables") expect(i.era).toBe("x");
      if (i.date) expect(i.era).toBe("5");
      if (i.date) expect(i.date).toMatch(/(exact|estimate|traditional)\)$/);
    }
    expect(t.items.filter((i) => i.date).length).toBe(6);
  });
  test("every era has items and a note that does not claim a date before the final era", () => {
    for (const e of t.eras) expect(t.items.some((i) => i.era === e.k)).toBe(true);
    for (const e of t.eras.filter((x) => x.k !== "5")) expect(e.note).not.toMatch(/\b\d{3,4}\b/);
  });
});

describe("draft Last Hour content", () => {
  const { signs } = draftLastHour();
  test("ten major signs, no date, no countdown, hadith numbers left as placeholders", () => {
    expect(signs.filter((s) => s.major)).toHaveLength(10);
    const text = JSON.stringify(signs);
    expect(text).not.toMatch(/\b(1[3-9]\d\d|2\d\d\d)\b/);
    expect(text.toLowerCase()).not.toMatch(/countdown|years remaining|days left/);
    for (const s of signs) if (s.source) expect(s.source).toMatch(/No\. —$/);
  });
  test("every sign names its kind of evidence and a Quran citation is a real reference shape", () => {
    for (const s of signs) {
      expect(s.evidence.length).toBeGreaterThan(0);
      for (const r of s.refs) expect(r).toMatch(/^\d{1,3}:\d{1,3}/);
    }
  });
});

describe("draft lineage content", () => {
  const { spine, branches } = draftLineage();
  test("starts at Adam, ends at Muhammad, and shows an unknown stretch as a gap with no names", () => {
    expect(spine[0]!.id).toBe("adam");
    expect(spine.at(-1)!.id).toBe("muhammad");
    const gaps = spine.filter((n) => n.role === "gap");
    expect(gaps.length).toBeGreaterThanOrEqual(3);
    for (const g of gaps) {
      expect(g.arabic).toBe("");
      expect(g.link).toBe("unknown");
      expect(g.note).toMatch(/^Not established/);
    }
  });
  test("every person has an Arabic name, a source note and a citation; no depiction fields exist", () => {
    for (const n of [...spine, ...branches.flatMap((b) => b.nodes)].filter((x) => x.role !== "gap")) {
      expect(n.arabic.length).toBeGreaterThan(1);
      expect(n.refs.length).toBeGreaterThan(0);
      expect(n.note.length).toBeGreaterThan(10);
    }
    expect(JSON.stringify(spine)).not.toMatch(/image|portrait|photo|depict/i);
  });
  test("hadith numbers are placeholders until pinned", () => {
    for (const n of spine) for (const r of n.refs) if (/Sahih/.test(r)) expect(r).toMatch(/No\. —$/);
  });
});

describe("draft Names dial content", () => {
  test("the dial gets the registry list in each interface language and states no count", () => {
    for (const l of ["en", "ar", "ur"]) {
      const d = draftDialNames(l);
      expect(d.length).toBeGreaterThan(0);
      expect(d.every((n) => n.draft && n.vowelled && n.transliteration)).toBe(true);
    }
    expect(draftDialNames("ar")[1]!.meaning).not.toBe(draftDialNames("en")[1]!.meaning);
  });
});
