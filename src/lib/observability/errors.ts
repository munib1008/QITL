/**
 * Error tracking and structured server logging, without PII.
 *
 *   logEvent / logError  one JSON line on stdout/stderr (the host's log drain collects it), safe keys only.
 *   reportError          logError + an optional error report to Sentry, when SENTRY_DSN is set (off otherwise). It
 *                        speaks Sentry's envelope HTTP API directly (no SDK, no client-side script, nothing sent from
 *                        browsers). Any Sentry-compatible collector (self-hosted Sentry, GlitchTip) works.
 *
 * Everything is scrubbed by src/lib/observability/scrub.ts first: no bodies, headers, cookies, query strings, IPs,
 * emails or user ids, and no message at all from private routes (dreams, mufti, notes, account).
 */
import { isPrivatePath, safeFields, scrubMessage, scrubPath, scrubStack } from "./scrub";

type Level = "info" | "warn" | "error";

function line(level: Level, event: string, fields?: Record<string, unknown>) {
  const path = typeof fields?.path === "string" ? fields.path : typeof fields?.route === "string" ? fields.route : undefined;
  const out = JSON.stringify({ level, event, ts: new Date().toISOString(), ...safeFields(fields, path) });
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.info(out);
}

export function logEvent(event: string, fields?: Record<string, unknown>) {
  line("info", event, fields);
}
export function logWarn(event: string, fields?: Record<string, unknown>) {
  line("warn", event, fields);
}
export function logError(event: string, fields?: Record<string, unknown>) {
  line("error", event, fields);
}

export interface ParsedDsn {
  endpoint: string;
  publicKey: string;
  dsn: string;
}

/** https://<key>@<host>/<project> → the envelope endpoint, or null when the DSN is missing or malformed. */
export function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\/+|\/+$/g, "");
    if (u.protocol !== "https:" || !u.username || !/^\d+$/.test(project.split("/").pop() ?? "")) return null;
    const prefix = project.split("/").slice(0, -1).join("/");
    const id = project.split("/").pop()!;
    return { endpoint: `${u.origin}/${prefix ? `${prefix}/` : ""}api/${id}/envelope/`, publicKey: u.username, dsn };
  } catch {
    return null;
  }
}

export interface ErrorContext {
  path?: string;
  method?: string;
  routeType?: string;
  renderSource?: string;
  digest?: string;
  code?: string;
  status?: number;
}

export interface SentryEvent {
  event_id: string;
  timestamp: number;
  platform: "javascript";
  level: "error";
  environment: string;
  release?: string;
  transaction?: string;
  exception: { values: Array<{ type: string; value: string; stacktrace?: { frames: Array<{ filename: string; lineno?: number; colno?: number; function?: string }> } }> };
  tags: Record<string, string>;
  extra: Record<string, string | number | boolean | null>;
}

function frames(stack: string | undefined) {
  const s = scrubStack(stack);
  if (!s) return undefined;
  const out = s
    .split("\n")
    .map((l) => l.trim().match(/^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ function: m[1], filename: m[2]!.replace(/^.*[\\/](\.next|src|node_modules)[\\/]/, "$1/"), lineno: Number(m[3]), colno: Number(m[4]) }))
    .reverse(); // Sentry wants the innermost frame last.
  return out.length ? { frames: out } : undefined;
}

/** The scrubbed event that would be sent. Exported for tests: no private text may appear in it. */
export function buildEvent(err: unknown, ctx: ErrorContext = {}, env: Record<string, string | undefined> = process.env): SentryEvent {
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "non-error thrown");
  const path = ctx.path ? scrubPath(ctx.path) : undefined;
  const value = scrubMessage(e.message, ctx.path);
  const id = crypto.randomUUID().replace(/-/g, "");
  return {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    environment: env.SENTRY_ENVIRONMENT ?? env.VERCEL_ENV ?? env.NODE_ENV ?? "production",
    ...(env.SENTRY_RELEASE ?? env.VERCEL_GIT_COMMIT_SHA ? { release: env.SENTRY_RELEASE ?? env.VERCEL_GIT_COMMIT_SHA } : {}),
    ...(path ? { transaction: `${ctx.method ?? ""} ${path}`.trim() } : {}),
    exception: { values: [{ type: e.name || "Error", value, ...(frames(e.stack) ? { stacktrace: frames(e.stack) } : {}) }] },
    tags: {
      ...(ctx.routeType ? { routeType: ctx.routeType } : {}),
      ...(ctx.renderSource ? { renderSource: ctx.renderSource } : {}),
      private: String(isPrivatePath(ctx.path)),
    },
    extra: safeFields({ digest: ctx.digest, code: ctx.code ?? (err as { code?: string })?.code, status: ctx.status, method: ctx.method }, ctx.path),
  };
}

export function envelope(event: SentryEvent, dsn: ParsedDsn): string {
  return [
    JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString(), dsn: dsn.dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}

/**
 * Log an error and, when SENTRY_DSN is set, report it. Never throws and never blocks for more than 2 seconds.
 * Pass the request path (not the URL with its query) and nothing user-provided beyond it.
 */
export async function reportError(err: unknown, ctx: ErrorContext = {}, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<void> {
  const event = buildEvent(err, ctx);
  logError("server_error", { path: ctx.path, method: ctx.method, digest: ctx.digest, errorName: event.exception.values[0]?.type, code: event.extra.code ?? undefined });
  const dsn = parseDsn(process.env.SENTRY_DSN);
  if (!dsn) return;
  try {
    await fetchImpl(dsn.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=qitl/1.0`,
      },
      body: envelope(event, dsn),
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
  } catch {
    logWarn("error_report_failed", { errorName: "fetch" });
  }
}
