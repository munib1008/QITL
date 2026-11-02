import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ sb: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ getPublicSupabase: () => state.sb }));
import { publicAiDraftGate } from "@/lib/stories/ai-draft-gate";

describe("public AI-draft gate", () => {
  beforeEach(() => {
    state.sb = null;
  });
  test("no database: null, so the offline file index is shown", async () => {
    expect(await publicAiDraftGate()).toBeNull();
  });
  test("a database: only the slugs it released, with their scholarly status", async () => {
    state.sb = { rpc: async () => ({ data: [{ slug: "yusuf", scholarly_status: "not_reviewed" }], error: null }) };
    const g = (await publicAiDraftGate())!;
    expect([...g.keys()]).toEqual(["yusuf"]);
    expect(g.get("yusuf")!.scholarly_status).toBe("not_reviewed");
  });
  test("a database error fails closed: nothing is public", async () => {
    state.sb = { rpc: async () => ({ data: null, error: { message: "boom" } }) };
    expect((await publicAiDraftGate())!.size).toBe(0);
  });
});
