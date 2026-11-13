import { vi, describe, expect, test } from "vitest";
vi.mock("server-only", () => ({}));
import { DRAFT_INDEX } from "@/lib/stories/draft-data";
import { draftOutline, draftSlugFor } from "@/lib/stories/draft-outline";

describe("draft outline for prophet pages", () => {
  test("journey ids that differ from the draft slug are aliased", () => {
    expect(draftSlugFor("dhulkifl")).toBe("dhul-kifl");
    expect(draftSlugFor("zakariya")).toBe("zakariyya");
    expect(draftSlugFor("yusuf")).toBe("yusuf");
  });
  test("every prophet draft yields an outline with a title, a summary free of claim markers, and valid verse refs", () => {
    const prophets = DRAFT_INDEX.stories.filter((s) => s.type === "prophet");
    expect(prophets.length).toBe(25);
    for (const p of prophets) {
      const steps = draftOutline(p.slug)!;
      expect(steps.length, p.slug).toBeGreaterThan(0);
      for (const s of steps) {
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.summary).not.toMatch(/\[c\d+\]/);
        for (const r of s.refs) {
          expect(r.surah).toBeGreaterThanOrEqual(1);
          expect(r.surah).toBeLessThanOrEqual(114);
          expect(r.to).toBeGreaterThanOrEqual(r.from);
        }
      }
    }
  });
  test("an unknown slug has no outline", () => {
    expect(draftOutline("not-a-prophet")).toBeNull();
  });
});
