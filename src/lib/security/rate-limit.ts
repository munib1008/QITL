/**
 * Server-side rate limiting: a sliding window per key (an IP address or a user id), in front of every API route.
 *
 *   - Per IP, for every /api request, in the middleware (src/middleware.ts): stops floods from signed-out clients
 *     before a route runs. Buckets by path: search and the CSP report endpoint are tighter than other reads, mutations
 *     tighter still.
 *   - Per user, for every signed-in API call, in requireUser (src/lib/api.ts).
 *   - Per user in the database for writes that must hold whatever the client (comments, discussions, reports, dream
 *     requests, and the paid AI/translation/narration calls through throttle_action): public.throttle().
 *
 * Stores: "memory" (default; per server instance, needs no service) or "upstash" (any Upstash-compatible Redis REST
 * endpoint, shared by every instance: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN). If the remote store fails,
 * the request is allowed (fail open) and the failure is logged: rate limiting protects availability, it must not
 * become an outage of its own. RATE_LIMIT_DISABLED=1 turns the HTTP limits off (the database throttle stays).
 *
 * Limits are "<count>/<seconds>" and can be overridden per bucket: RATE_LIMIT_SEARCH="30/60" and so on.
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until a request would be allowed again (0 when allowed). */
  retryAfter: number;
}

export interface RateLimitStore {
  readonly name: string;
  /** Record one hit for key and say whether it is within limit hits per windowMs. */
  hit(key: string, limit: number, windowMs: number, now?: number): Promise<RateLimitResult>;
}

/**
 * Exact sliding-window log in memory. Each key keeps the timestamps of its hits in the window (at most `limit` of
 * them: a refused hit is not recorded, so a client that keeps hammering is let back in as soon as the window slides).
 * Bounded: at most maxKeys keys, the oldest evicted first.
 */
export class MemoryStore implements RateLimitStore {
  readonly name = "memory";
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly maxKeys = 50_000) {}

  async hit(key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateLimitResult> {
    const since = now - windowMs;
    const log = (this.hits.get(key) ?? []).filter((t) => t > since);
    const allowed = limit > 0 && log.length < limit;
    if (allowed) log.push(now);
    // Re-insert so Map order is least-recently-used first.
    this.hits.delete(key);
    this.hits.set(key, log);
    if (this.hits.size > this.maxKeys) this.hits.delete(this.hits.keys().next().value as string);
    const retryAfter = allowed ? 0 : Math.max(1, Math.ceil(((log[0] ?? now) + windowMs - now) / 1000));
    return { allowed, limit, remaining: Math.max(0, limit - log.length), retryAfter };
  }

  /** For tests. */
  reset() {
    this.hits.clear();
  }
}

/** The same sliding window as an atomic Lua script on a sorted set (Upstash REST /pipeline-compatible EVAL). */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
local allowed = 0
if count < limit then
  redis.call('ZADD', key, now, member)
  count = count + 1
  allowed = 1
end
redis.call('PEXPIRE', key, window)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local first = now
if oldest[2] then first = tonumber(oldest[2]) end
return {allowed, count, first}
`;

export class UpstashStore implements RateLimitStore {
  readonly name = "upstash";
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
    private readonly prefix = "qitl:rl:",
  ) {}

  async hit(key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateLimitResult> {
    const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
    const res = await this.fetchImpl(this.url.replace(/\/$/, ""), {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", SLIDING_WINDOW_LUA, "1", this.prefix + key, String(now), String(windowMs), String(limit), member]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`rate limit store responded ${res.status}`);
    const body = (await res.json()) as { result?: [number, number, number]; error?: string };
    if (!body.result) throw new Error("rate limit store returned no result");
    const [ok, count, first] = body.result;
    const allowed = ok === 1;
    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - count),
      retryAfter: allowed ? 0 : Math.max(1, Math.ceil((Number(first) + windowMs - now) / 1000)),
    };
  }
}

export interface Bucket {
  limit: number;
  windowMs: number;
}

/** Default limits. Generous for reading, which is free and public; tighter where a request costs more. */
export const DEFAULT_BUCKETS = {
  /** Any /api request, per IP. */
  api: { limit: 300, windowMs: 60_000 },
  /** /api/search, per IP (a database full-text query each). */
  search: { limit: 60, windowMs: 60_000 },
  /** POST/PUT/PATCH/DELETE on /api, per IP. */
  mutation: { limit: 60, windowMs: 60_000 },
  /** Unauthenticated token endpoints (unsubscribe), per IP. */
  token: { limit: 20, windowMs: 60_000 },
  /** Browser CSP violation reports, per IP. */
  report: { limit: 30, windowMs: 60_000 },
  /** Every signed-in API call, per user. */
  user: { limit: 240, windowMs: 60_000 },
  /** Signed-in mutations, per user. */
  userMutation: { limit: 60, windowMs: 60_000 },
} as const satisfies Record<string, Bucket>;

export type BucketName = keyof typeof DEFAULT_BUCKETS;

/** "30/60" → 30 requests per 60 seconds. Invalid values fall back to the default. */
export function parseBucket(value: string | undefined, fallback: Bucket): Bucket {
  const m = value?.trim().match(/^(\d{1,6})\s*\/\s*(\d{1,6})$/);
  if (!m) return fallback;
  const limit = Number(m[1]);
  const seconds = Number(m[2]);
  if (seconds < 1) return fallback;
  return { limit, windowMs: seconds * 1000 };
}

export function bucket(name: BucketName, env: Record<string, string | undefined> = process.env): Bucket {
  const envName = `RATE_LIMIT_${name.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`;
  return parseBucket(env[envName], DEFAULT_BUCKETS[name]);
}

export function rateLimitDisabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.RATE_LIMIT_DISABLED === "1" || env.RATE_LIMIT_DISABLED === "true";
}

let store: RateLimitStore | null = null;

export function getStore(env: Record<string, string | undefined> = process.env): RateLimitStore {
  if (store) return store;
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  const wanted = env.RATE_LIMIT_STORE ?? (url && token ? "upstash" : "memory");
  store = wanted === "upstash" && url && token ? new UpstashStore(url, token) : new MemoryStore();
  return store;
}

/** For tests: replace the process-wide store. */
export function setStore(s: RateLimitStore | null) {
  store = s;
}

/** Check one bucket for one key. Never throws: a broken store allows the request (and is logged). */
export async function check(name: BucketName, key: string, now?: number): Promise<RateLimitResult> {
  const b = bucket(name);
  if (rateLimitDisabled()) return { allowed: true, limit: b.limit, remaining: b.limit, retryAfter: 0 };
  try {
    return await getStore().hit(`${name}:${key}`, b.limit, b.windowMs, now);
  } catch (e) {
    console.error(JSON.stringify({ level: "error", event: "rate_limit_store_failed", bucket: name, error: (e as Error).name }));
    return { allowed: true, limit: b.limit, remaining: b.limit, retryAfter: 0 };
  }
}

/** The client IP as the host's proxy reports it (first X-Forwarded-For hop, X-Real-IP), or "unknown". */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  const ip = first || headers.get("x-real-ip")?.trim() || "";
  // Keep only characters an IPv4/IPv6 address can have, so a forged header cannot inject into a key.
  const clean = ip.replace(/[^0-9a-fA-F:.]/g, "").slice(0, 45);
  return clean || "unknown";
}

/** Which IP bucket an API request falls in, besides the general "api" bucket. */
export function apiBucketFor(method: string, pathname: string): BucketName | null {
  if (pathname === "/api/csp-report") return "report";
  if (pathname.startsWith("/api/unsubscribe")) return "token";
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") return "mutation";
  if (pathname.startsWith("/api/search")) return "search";
  return null;
}

/** Standard headers for a limited response. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(r.limit),
    "RateLimit-Remaining": String(r.remaining),
    ...(r.allowed ? {} : { "Retry-After": String(r.retryAfter) }),
  };
}

export function tooManyRequests(r: RateLimitResult): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Try again shortly.", code: "rate_limited", retryAfter: r.retryAfter }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...rateLimitHeaders(r) },
  });
}
