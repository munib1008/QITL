import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { DRAFT_INDEX } from "@/lib/stories/draft-data";
import { draftsCitingSurah } from "@/lib/stories/draft-related";

describe("related drafts of an ayah", () => {
  test("Yusuf's draft is listed on the ayat of Surat Yusuf that one of its chapters cites, and only there", () => {
    const m = draftsCitingSurah(12);
    const yusuf = DRAFT_INDEX.stories.find((s) => s.slug === "yusuf")!;
    const cited = new Set<number>();
    for (const c of yusuf.chapters) for (const v of c.verses) if (v.surah === 12) for (let a = v.from; a <= (v.to ?? v.from); a++) cited.add(a);
    expect(cited.size).toBeGreaterThan(20);
    for (const a of cited) expect(m.get(a)!.map((d) => d.slug), `12:${a}`).toContain("yusuf");
    for (const [a, list] of m) if (list.some((d) => d.slug === "yusuf")) expect(cited.has(a), `12:${a}`).toBe(true);
  });
  test("a story appears once per ayah, and the allow-list (the public gate) filters", () => {
    for (const [, list] of draftsCitingSurah(12)) expect(new Set(list.map((d) => d.slug)).size).toBe(list.length);
    expect(draftsCitingSurah(12, new Set(["not-a-draft"])).size).toBe(0);
    const only = draftsCitingSurah(12, new Set(["yusuf"]));
    for (const [, list] of only) expect(list.map((d) => d.slug)).toEqual(["yusuf"]);
  });
  test("a surah no draft cites has no related drafts", () => {
    const cited = new Set<number>();
    for (const s of DRAFT_INDEX.stories) for (const c of s.chapters) for (const v of c.verses) cited.add(v.surah);
    const none = [...Array(114).keys()].map((i) => i + 1).find((n) => !cited.has(n));
    if (none) expect(draftsCitingSurah(none).size).toBe(0);
  });
});
