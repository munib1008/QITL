// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const SECRETS = ["LARA_ACCESS_KEY_ID", "LARA_ACCESS_KEY_SECRET", "ANTHROPIC_API_KEY", "NARRATION_PROVIDER", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
beforeEach(() => {
  for (const k of SECRETS) vi.stubEnv(k, "");
});

const ORIGIN = "http://localhost:3000";
const req = (path: string, method: string, body?: unknown) =>
  new NextRequest(`${ORIGIN}${path}`, { method, headers: { origin: ORIGIN, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const uuid = "00000000-0000-4000-8000-000000000001";

async function expectNotConfigured(res: Response) {
  expect(res.status).toBe(503);
  expect(((await res.json()) as { code: string }).code).toBe("not_configured");
}

describe("production routes answer 503 not_configured without their provider", () => {
  test("translation needs LARA_ACCESS_KEY_ID and LARA_ACCESS_KEY_SECRET", async () => {
    const { POST } = await import("@/app/api/admin/studio/translate/route");
    await expectNotConfigured(await POST(req("/api/admin/studio/translate", "POST", { scriptId: uuid, targetLanguage: "ar" })));
    vi.stubEnv("LARA_ACCESS_KEY_ID", "id-only");
    await expectNotConfigured(await POST(req("/api/admin/studio/translate", "POST", { scriptId: uuid, targetLanguage: "ar" })));
  });
  test("narration needs a registered provider", async () => {
    const { POST } = await import("@/app/api/admin/studio/narrate/route");
    await expectNotConfigured(await POST(req("/api/admin/studio/narrate", "POST", { sceneId: uuid, voiceId: uuid })));
    vi.stubEnv("NARRATION_PROVIDER", "unregistered");
    await expectNotConfigured(await POST(req("/api/admin/studio/narrate", "POST", { sceneId: uuid, voiceId: uuid })));
  });
  test("Claude-assisted drafting needs ANTHROPIC_API_KEY", async () => {
    const { POST } = await import("@/app/api/admin/studio/draft/route");
    await expectNotConfigured(await POST(req("/api/admin/studio/draft", "POST", { personId: uuid, language: "en", audience: "full", title: "t", claimIds: [uuid] })));
  });
  test("with a provider but no database, the route still reports not_configured", async () => {
    vi.stubEnv("LARA_ACCESS_KEY_ID", "test-id");
    vi.stubEnv("LARA_ACCESS_KEY_SECRET", "test-secret");
    const { POST } = await import("@/app/api/admin/studio/translate/route");
    await expectNotConfigured(await POST(req("/api/admin/studio/translate", "POST", { scriptId: uuid, targetLanguage: "ar" })));
  });
  test("studio workflow routes need the database", async () => {
    for (const [path, body] of [
      ["scripts", { personId: uuid, language: "en", audience: "full", title: "t", scenes: [] }],
      ["claims", { sceneId: uuid, claimId: uuid }],
      ["review", { action: "request", scriptId: uuid }],
      ["translation-review", { scriptId: uuid, aspect: "linguistic", decision: "approved" }],
      ["audio", { action: "approve", audioId: uuid }],
      ["ambience", { action: "approve", key: "rain" }],
    ] as const) {
      const { POST } = (await import(`@/app/api/admin/studio/${path}/route`)) as { POST: (r: NextRequest) => Promise<Response> };
      await expectNotConfigured(await POST(req(`/api/admin/studio/${path}`, "POST", body)));
    }
  });
  test("cross-site requests are refused before anything else", async () => {
    const { POST } = await import("@/app/api/admin/studio/review/route");
    const r = new NextRequest(`${ORIGIN}/api/admin/studio/review`, { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" });
    expect((await POST(r)).status).toBe(403);
  });
});

describe("reader playback routes", () => {
  test("preferences and progress answer not_configured without the database", async () => {
    const prefs = await import("@/app/api/me/playback/preferences/route");
    const progress = await import("@/app/api/me/playback/progress/route");
    await expectNotConfigured(await prefs.GET(req("/api/me/playback/preferences", "GET")));
    await expectNotConfigured(await prefs.PUT(req("/api/me/playback/preferences", "PUT", {})));
    await expectNotConfigured(await progress.GET(req(`/api/me/playback/progress?scriptId=${uuid}`, "GET")));
    await expectNotConfigured(await progress.PUT(req("/api/me/playback/progress", "PUT", { scriptId: uuid, sceneId: null, positionMs: 0 })));
  });
});

describe("provider helpers", () => {
  test("translation idempotency key is script id + version + language", async () => {
    const { translationIdempotencyKey, countCharacters, laraConfigured } = await import("@/lib/production/lara");
    expect(translationIdempotencyKey(uuid, 3, "ar")).toBe(`${uuid}:v3:ar`);
    expect(countCharacters(["ab", "ﷺ"])).toBe(3);
    expect(laraConfigured({ LARA_ACCESS_KEY_ID: "a", LARA_ACCESS_KEY_SECRET: "b" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(laraConfigured({ LARA_ACCESS_KEY_ID: "a" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
  test("no narration provider ships", async () => {
    const { getNarrationProvider, narrationIdempotencyKey } = await import("@/lib/production/narration");
    expect(getNarrationProvider({ NARRATION_PROVIDER: "anything" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(narrationIdempotencyKey("s", "v", "h")).toBe("s:v:h");
  });
  test("AI drafts keep only the editor's claims and mark unsupported statements", async () => {
    const { sanitizeDraft, UNSUPPORTED_MARK, DRAFT_MODEL } = await import("@/lib/production/draft");
    expect(DRAFT_MODEL).toBe("claude-opus-5-5");
    const out = sanitizeDraft(
      {
        scenes: [
          { kind: "world", step_role: "action", title: "W", narration_text: "Text.", lessons: [" l "], claim_ids: ["a", "zzz", "a"], unsupported: ["an extra detail"] },
          { kind: "sequence", step_role: "challenge", title: "", narration_text: "", lessons: [], claim_ids: [], unsupported: [] },
        ],
      },
      new Set(["a"]),
    );
    expect(out[0]).toMatchObject({ step_role: null, claim_ids: ["a"], lessons: ["l"], unsupported: 1 });
    expect(out[0]!.narration_text).toContain(`${UNSUPPORTED_MARK}an extra detail]`);
    expect(out[1]).toMatchObject({ step_role: "challenge", title: "sequence" });
    expect(out[1]!.narration_text.startsWith(UNSUPPORTED_MARK)).toBe(true);
  });
});
