// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { API_CSP, buildCsp, cspHeaderName, cspMode, directive, makeNonce, originOf } from "@/lib/security/csp";
import { MemoryStore, UpstashStore, apiBucketFor, bucket, check, clientIp, parseBucket, setStore } from "@/lib/security/rate-limit";
import { isPrivatePath, safeFields, scrubMessage, scrubPath } from "@/lib/observability/scrub";
import { buildEvent, envelope, parseDsn, reportError } from "@/lib/observability/errors";
import { payload } from "@/lib/observability/analytics";
import { middleware } from "@/middleware";

vi.mock("server-only", () => ({}));

const NONCE = "AAAAAAAAAAAAAAAAAAAAAA==";

describe("CSP", () => {
  test("scripts: nonce + strict-dynamic, never unsafe-inline; unsafe-eval only in development", () => {
    const prod = buildCsp({ nonce: NONCE });
    const script = directive(prod, "script-src")!;
    expect(script).toBe(`script-src 'self' 'nonce-${NONCE}' 'strict-dynamic'`);
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(directive(buildCsp({ nonce: NONCE, dev: true }), "script-src")).toContain("'unsafe-eval'");
  });

  test("network directives are limited to self, the Supabase project, the tile server and (when on) analytics", () => {
    const p = buildCsp({
      nonce: NONCE,
      supabaseUrl: "https://abcd.supabase.co/",
      mapTilesUrl: "https://tiles.example.org/styles/x.json",
      siteUrl: "https://qitl.org",
      reportUri: "/api/csp-report",
    });
    expect(directive(p, "connect-src")).toBe("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co https://tiles.example.org");
    expect(directive(p, "img-src")).toBe("img-src 'self' data: blob: https://abcd.supabase.co https://tiles.example.org");
    expect(directive(p, "media-src")).toBe("media-src 'self' blob: https://abcd.supabase.co");
    expect(directive(p, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(p, "object-src")).toBe("object-src 'none'");
    expect(directive(p, "upgrade-insecure-requests")).toBeDefined();
    expect(directive(p, "report-uri")).toBe("report-uri /api/csp-report");
    expect(p).not.toMatch(/\*/);
    const withAnalytics = buildCsp({ nonce: NONCE, analyticsUrl: "https://stats.example.org/api/event" });
    expect(directive(withAnalytics, "connect-src")).toBe("connect-src 'self' https://stats.example.org");
  });

  test("bad inputs: a non-URL host is ignored, a malformed nonce is refused", () => {
    expect(originOf("javascript:alert(1)")).toBe("");
    expect(originOf("not a url")).toBe("");
    expect(directive(buildCsp({ nonce: NONCE, supabaseUrl: "javascript:x" }), "connect-src")).toBe("connect-src 'self'");
    expect(() => buildCsp({ nonce: "'unsafe-inline'" })).toThrow();
  });

  test("nonces are unique base64 of 128 bits", () => {
    const a = makeNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(new Set(Array.from({ length: 50 }, makeNonce)).size).toBe(50);
  });

  test("mode: enforce by default, report-only on request", () => {
    expect(cspMode(undefined)).toBe("enforce");
    expect(cspMode("report-only")).toBe("report-only");
    expect(cspHeaderName("enforce")).toBe("Content-Security-Policy");
    expect(cspHeaderName("report-only")).toBe("Content-Security-Policy-Report-Only");
  });

  test("next.config's API policy matches API_CSP and next.config sets no page CSP of its own", () => {
    const cfg = readFileSync(join(__dirname, "..", "..", "next.config.ts"), "utf8");
    expect(cfg).toContain(`const API_CSP = "${API_CSP}"`);
    expect(cfg).not.toContain("unsafe-inline");
  });
});

describe("middleware: CSP on pages, rate limits on the API", () => {
  beforeEach(() => setStore(new MemoryStore()));
  afterEach(() => {
    setStore(null);
    vi.unstubAllEnvs();
  });
  const page = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));
  const api = (path: string, ip: string, method = "GET") => new NextRequest(new URL(path, "http://localhost:3000"), { method, headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

  test("each page response carries a fresh nonce, on the response and on the forwarded request", async () => {
    const a = await middleware(page("/quran/1"));
    const b = await middleware(page("/quran/1"));
    const pa = a.headers.get("content-security-policy")!;
    const nonce = pa.match(/'nonce-([^']+)'/)![1]!;
    expect(pa).not.toEqual(b.headers.get("content-security-policy"));
    // Next.js forwards overridden request headers as x-middleware-request-*.
    expect(a.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(a.headers.get("x-middleware-request-content-security-policy")).toBe(pa);
    expect(a.headers.get("x-middleware-rewrite")).toContain("/en/quran/1");
  });

  test("Arabic and Urdu paths get the policy too; report-only mode uses the report-only header", async () => {
    expect((await middleware(page("/ar/quran/1"))).headers.get("content-security-policy")).toMatch(/'nonce-/);
    vi.stubEnv("CSP_MODE", "report-only");
    const r = await middleware(page("/ur"));
    expect(r.headers.get("content-security-policy")).toBeNull();
    expect(r.headers.get("content-security-policy-report-only")).toMatch(/'nonce-/);
  });

  test("the API is limited per IP with 429 and Retry-After; other IPs are unaffected", async () => {
    vi.stubEnv("RATE_LIMIT_SEARCH", "3/60");
    for (let i = 0; i < 3; i++) expect((await middleware(api("/api/search?q=x", "203.0.113.5"))).status).toBe(200);
    const limited = await middleware(api("/api/search?q=x", "203.0.113.5"));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(((await limited.json()) as { code: string }).code).toBe("rate_limited");
    expect((await middleware(api("/api/search?q=x", "203.0.113.6"))).status).toBe(200);
    // Other read endpoints use the general bucket.
    expect((await middleware(api("/api/journey", "203.0.113.5"))).status).toBe(200);
  });

  test("mutations have their own, tighter IP bucket; RATE_LIMIT_DISABLED turns limits off", async () => {
    vi.stubEnv("RATE_LIMIT_MUTATION", "1/60");
    expect((await middleware(api("/api/reports", "198.51.100.1", "POST"))).status).toBe(200);
    expect((await middleware(api("/api/reports", "198.51.100.1", "POST"))).status).toBe(429);
    vi.stubEnv("RATE_LIMIT_DISABLED", "1");
    expect((await middleware(api("/api/reports", "198.51.100.1", "POST"))).status).toBe(200);
  });

  test("API responses get no page CSP and no locale rewrite", async () => {
    const r = await middleware(api("/api/journey", "192.0.2.1"));
    expect(r.headers.get("content-security-policy")).toBeNull();
    expect(r.headers.get("x-middleware-rewrite")).toBeNull();
    expect(r.headers.get("ratelimit-limit")).toBe("300");
  });
});

describe("rate limiter", () => {
  test("sliding window: refuses over the limit, lets a hit back in as the window slides", async () => {
    const s = new MemoryStore();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect((await s.hit("k", 3, 10_000, t0 + i * 1000)).allowed).toBe(true);
    const no = await s.hit("k", 3, 10_000, t0 + 5000);
    expect(no).toMatchObject({ allowed: false, remaining: 0 });
    expect(no.retryAfter).toBe(5); // the first hit leaves the window at t0 + 10 s
    expect((await s.hit("k", 3, 10_000, t0 + 10_001)).allowed).toBe(true);
    expect((await s.hit("other", 3, 10_000, t0 + 5000)).allowed).toBe(true);
  });

  test("memory is bounded", async () => {
    const s = new MemoryStore(10);
    for (let i = 0; i < 50; i++) await s.hit(`k${i}`, 1, 60_000);
    expect((s as unknown as { hits: Map<string, number[]> }).hits.size).toBeLessThanOrEqual(10);
  });

  test("Upstash-compatible store: one atomic EVAL per hit, bearer token, parses the result", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ result: [0, 5, 1_000_000] }), { status: 200 });
    }) as unknown as typeof fetch;
    const s = new UpstashStore("https://redis.example.io/", "tok", fake);
    const r = await s.hit("ip:1", 5, 60_000, 1_030_000);
    expect(r).toEqual({ allowed: false, limit: 5, remaining: 0, retryAfter: 30 });
    expect(calls[0]!.url).toBe("https://redis.example.io");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    const body = JSON.parse(String(calls[0]!.init.body)) as string[];
    expect(body[0]).toBe("EVAL");
    expect(body[3]).toBe("qitl:rl:ip:1");
  });

  test("a failing store fails open (and logs without the key)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setStore({ name: "broken", hit: async () => { throw new Error("down 203.0.113.9"); } });
    expect((await check("api", "203.0.113.9")).allowed).toBe(true);
    expect(err.mock.calls[0]![0]).not.toContain("203.0.113.9");
    setStore(null);
    err.mockRestore();
  });

  test("bucket parsing and env overrides", () => {
    expect(parseBucket("30/60", { limit: 1, windowMs: 1 })).toEqual({ limit: 30, windowMs: 60_000 });
    expect(parseBucket("nonsense", { limit: 1, windowMs: 1 })).toEqual({ limit: 1, windowMs: 1 });
    expect(parseBucket("5/0", { limit: 1, windowMs: 1 })).toEqual({ limit: 1, windowMs: 1 });
    expect(bucket("userMutation", { RATE_LIMIT_USER_MUTATION: "7/10" })).toEqual({ limit: 7, windowMs: 10_000 });
    expect(bucket("search", {})).toEqual({ limit: 60, windowMs: 60_000 });
  });

  test("client IP: first forwarded hop, sanitised", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" }))).toBe("203.0.113.1");
    expect(clientIp(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIp(new Headers({ "x-forwarded-for": "evil:key;*" }))).toBe("e:e");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  test("bucket routing", () => {
    expect(apiBucketFor("GET", "/api/search")).toBe("search");
    expect(apiBucketFor("POST", "/api/discussions")).toBe("mutation");
    expect(apiBucketFor("GET", "/api/unsubscribe")).toBe("token");
    expect(apiBucketFor("POST", "/api/csp-report")).toBe("report");
    expect(apiBucketFor("GET", "/api/journey")).toBeNull();
  });
});

describe("requireUser: per-user limit", () => {
  afterEach(() => {
    setStore(null);
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("@/lib/supabase/server");
  });

  test("a signed-in user over the limit gets 429 with Retry-After; another user does not", async () => {
    setStore(new MemoryStore());
    vi.stubEnv("RATE_LIMIT_USER_MUTATION", "2/60");
    let uid = "u1";
    vi.doMock("@/lib/supabase/server", () => ({ getUser: async () => ({ sb: {}, user: { id: uid } }) }));
    const { requireUser, isResponse } = await import("@/lib/api");
    const req = () => new NextRequest("http://localhost:3000/api/me/notes", { method: "POST", headers: { origin: "http://localhost:3000" } });
    expect(isResponse(await requireUser(req()))).toBe(false);
    expect(isResponse(await requireUser(req()))).toBe(false);
    const r = await requireUser(req());
    expect(isResponse(r) && r.status).toBe(429);
    expect(isResponse(r) && Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    uid = "u2";
    expect(isResponse(await requireUser(req()))).toBe(false);
  });

  test("a database throttle error maps to 429 with Retry-After", async () => {
    const { dbError } = await import("@/lib/api");
    const r = dbError({ code: "P0429", message: "rate_limited: too many export actions" });
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("60");
  });
});

describe("monitoring: nothing private leaves the process", () => {
  const PRIVATE_TEXT = "I dreamt of my late father at the well";

  test("paths: ids and query strings are removed", () => {
    expect(scrubPath("/api/dreams/123e4567-e89b-12d3-a456-426614174000/second-opinion?token=abc")).toBe("/api/dreams/:id/second-opinion");
    expect(scrubPath("/hadith/bukhari/1234567")).toBe("/hadith/bukhari/:id");
  });

  test("private routes withhold the message entirely", () => {
    for (const p of ["/api/dreams", "/api/dreams/x", "/dreams/my/1", "/ur/mufti/questions/1", "/api/mufti/answers", "/api/me/notes", "/account", "/api/admin/dreams", "/api/admin/mufti/questions", "/community/questions/1"])
      expect(isPrivatePath(p)).toBe(true);
    expect(isPrivatePath("/quran/1")).toBe(false);
    expect(scrubMessage(`Failing row contains (${PRIVATE_TEXT})`, "/api/dreams")).toBe("[withheld: private route]");
  });

  test("elsewhere: row content, emails, tokens and long numbers are redacted", () => {
    const m = scrubMessage(`new row violates check. Failing row contains (abc, ${PRIVATE_TEXT}, x@y.com). Key (email)=(a@b.org) eyJhbGciOi.eyJzdWIi.sig sk-live_1234567890 phone 0712345678`);
    expect(m).not.toContain(PRIVATE_TEXT);
    expect(m).not.toMatch(/@/);
    expect(m).not.toContain("eyJ");
    expect(m).not.toContain("sk-live");
    expect(m).not.toContain("0712345678");
  });

  test("structured fields: only allow-listed keys survive", () => {
    expect(safeFields({ path: "/api/x?q=secret", body: PRIVATE_TEXT, email: "a@b.c", userId: "u", status: 500, code: "23505" })).toEqual({ path: "/api/x", status: 500, code: "23505" });
  });

  test("an error event from a dream route carries no private text, no query and no user data", () => {
    const err = new Error(`insert failed: Failing row contains (${PRIVATE_TEXT})`);
    const ev = buildEvent(err, { path: "/api/dreams/123e4567-e89b-12d3-a456-426614174000?x=1", method: "POST", digest: "d1" }, {});
    const s = JSON.stringify(ev);
    expect(s).not.toContain(PRIVATE_TEXT);
    expect(s).not.toContain("123e4567");
    expect(s).not.toContain("x=1");
    expect(ev.exception.values[0]!.value).toBe("[withheld: private route]");
    expect(ev.tags.private).toBe("true");
    expect(ev.transaction).toBe("POST /api/dreams/:id");
  });

  test("DSN parsing and the envelope format", () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("http://k@sentry.example.io/1")).toBeNull();
    expect(parseDsn("https://pub@o1.ingest.sentry.io/42")).toEqual({ endpoint: "https://o1.ingest.sentry.io/api/42/envelope/", publicKey: "pub", dsn: "https://pub@o1.ingest.sentry.io/42" });
    const d = parseDsn("https://pub@o1.ingest.sentry.io/42")!;
    const lines = envelope(buildEvent(new Error("boom"), { path: "/quran/1" }, {}), d).split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[1]!)).toEqual({ type: "event" });
    expect(JSON.parse(lines[2]!).exception.values[0].value).toBe("boom");
  });

  test("reportError sends nothing without SENTRY_DSN, and a scrubbed envelope with it", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubEnv("SENTRY_DSN", "");
    await reportError(new Error(PRIVATE_TEXT), { path: "/api/mufti/answers" }, fake as unknown as typeof fetch);
    expect(fake).not.toHaveBeenCalled();
    vi.stubEnv("SENTRY_DSN", "https://pub@o1.ingest.sentry.io/42");
    await reportError(new Error(PRIVATE_TEXT), { path: "/api/mufti/answers" }, fake as unknown as typeof fetch);
    expect(fake).toHaveBeenCalledTimes(1);
    const [, init] = fake.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).not.toContain(PRIVATE_TEXT);
    for (const call of err.mock.calls) expect(String(call[0])).not.toContain(PRIVATE_TEXT);
    vi.unstubAllEnvs();
    err.mockRestore();
  });
});

describe("analytics hook", () => {
  test("off-list events, private sections and Do Not Track send nothing", () => {
    expect(payload("pageview", "/dreams/my/1")).toBeNull();
    expect(payload("pageview", "/ur/mufti")).toBeNull();
    expect(payload("pageview", "/admin")).toBeNull();
    expect(payload("pageview", "/account")).toBeNull();
    expect(payload("pageview", "/quran/1", { dnt: true })).toBeNull();
    expect(payload("custom_free_text", "/quran/1")).toBeNull();
  });

  test("a page view carries only the event, the scrubbed path, the locale and an allow-listed value", () => {
    expect(payload("pageview", "/ar/hadith/bukhari/1234567?q=private")).toEqual({ event: "pageview", path: "/ar/hadith/bukhari/:id", locale: "ar" });
    expect(payload("search", "/search", { value: "Some typed query" })).toEqual({ event: "search", path: "/search", locale: "en" });
    expect(payload("language_switch", "/", { value: "ur" })).toEqual({ event: "language_switch", path: "/", locale: "en", value: "ur" });
  });
});
