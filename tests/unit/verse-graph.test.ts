import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { DRAFT_INDEX } from "@/lib/stories/draft-data";
import { allNodes, relatedNodes } from "@/lib/graph/verse-graph";

const storyAyat = (slug: string) => {
  const s = DRAFT_INDEX.stories.find((x) => x.slug === slug)!;
  const set = new Set<string>();
  for (const c of s.chapters) for (const v of c.verses ?? []) for (let a = v.from; a <= (v.to ?? v.from); a++) set.add(`${v.surah}:${a}`);
  return set;
};

describe("the shared evidence graph", () => {
  test("it has story, creation, guidance and lifestyle nodes", () => {
    const kinds = new Set(allNodes().map((n) => n.kind));
    for (const k of ["story", "creation", "guidance", "lifestyle"]) expect(kinds.has(k as never), k).toBe(true);
    expect(allNodes().filter((n) => n.kind === "story").length).toBe(DRAFT_INDEX.stories.length);
  });
  test("the shared count between two stories equals the independently computed overlap of their cited ayat", () => {
    const a = storyAyat("yusuf");
    const b = storyAyat("yaqub");
    const expected = [...a].filter((x) => b.has(x)).length;
    const rel = relatedNodes("story", "yusuf", { limit: 500 }).find((r) => r.node.kind === "story" && r.node.slug === "yaqub");
    if (expected === 0) expect(rel).toBeUndefined();
    else expect(rel!.shared).toBe(expected);
  });
  test("a node is never related to itself, and every sample ayah is cited by both nodes", () => {
    const rel = relatedNodes("story", "nuh", { limit: 500 });
    expect(rel.some((r) => r.node.kind === "story" && r.node.slug === "nuh")).toBe(false);
    const mine = storyAyat("nuh");
    for (const r of rel.filter((x) => x.node.kind === "story")) {
      const other = storyAyat(r.node.slug);
      for (const a of r.sample) {
        expect(mine.has(a), a).toBe(true);
        expect(other.has(a), a).toBe(true);
      }
    }
  });
  test("relations are symmetric (B in A's list with n shared means A is in B's list with n shared)", () => {
    for (const slug of ["adam", "ibrahim", "musa"]) {
      for (const r of relatedNodes("story", slug, { limit: 500 })) {
        const back = relatedNodes(r.node.kind, r.node.slug, { limit: 500 }).find((x) => x.node.kind === "story" && x.node.slug === slug);
        expect(back?.shared, `${slug} <-> ${r.node.kind}:${r.node.slug}`).toBe(r.shared);
      }
    }
  });
  test("results are ranked by shared ayat, capped by the limit, and every link points at a real node", () => {
    const rel = relatedNodes("story", "ibrahim", { limit: 6 });
    expect(rel.length).toBeLessThanOrEqual(6);
    for (let i = 1; i < rel.length; i++) expect(rel[i - 1]!.shared).toBeGreaterThanOrEqual(rel[i]!.shared);
    const hrefs = new Set(allNodes().map((n) => n.href));
    for (const r of rel) expect(hrefs.has(r.node.href), r.node.href).toBe(true);
  });
  test("the public allow-list filters story nodes but not the other kinds", () => {
    const only = relatedNodes("creation", "human-beings", { allowStories: new Set(["adam"]), limit: 500 });
    for (const r of only) if (r.node.kind === "story") expect(r.node.slug).toBe("adam");
    expect(relatedNodes("creation", "human-beings", { allowStories: new Set(), limit: 500 }).every((r) => r.node.kind !== "story")).toBe(true);
  });
  test("an unknown node has no relations", () => {
    expect(relatedNodes("story", "not-a-story")).toEqual([]);
  });
});
