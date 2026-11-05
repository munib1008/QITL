import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stories/ai-draft-gate", () => ({ publicAiDraftGate: vi.fn(async () => null) }));
import { searchAiDrafts } from "@/lib/search-drafts";
import { DRAFT_INDEX } from "@/lib/stories/draft-data";
import * as gate from "@/lib/stories/ai-draft-gate";

describe("AI drafts in search", () => {
  test("a draft title finds its draft page and says it is not scholar-reviewed", async () => {
    const s = DRAFT_INDEX.stories[0]!;
    const hits = await searchAiDrafts(s.title_en);
    const hit = hits.find((h) => h.url === `/drafts/${s.slug}`);
    expect(hit).toBeTruthy();
    expect(hit!.snippet).toMatch(/not scholar-reviewed/);
    expect(hit!.facet).toBe("stories");
  });
  test("with a database, only drafts it released are searchable (fails closed on an empty gate)", async () => {
    const s = DRAFT_INDEX.stories[0]!;
    vi.mocked(gate.publicAiDraftGate).mockResolvedValueOnce(new Map());
    expect(await searchAiDrafts(s.title_en)).toEqual([]);
    vi.mocked(gate.publicAiDraftGate).mockResolvedValueOnce(new Map([[s.slug, { scholarly_status: "not_reviewed" }]]));
    expect((await searchAiDrafts(s.title_en)).some((h) => h.url === `/drafts/${s.slug}`)).toBe(true);
  });
});
