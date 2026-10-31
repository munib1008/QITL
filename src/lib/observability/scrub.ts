/**
 * Privacy scrubbing for everything that leaves the process as a log line, an error report or an analytics event.
 *
 * Rules (docs/SECURITY.md, "Monitoring"):
 *   - Never a request body, header, cookie, query string, IP address, email or user id.
 *   - On private routes (dream requests, mufti questions and answers, private notes, the account) an error's message is
 *     withheld entirely: a database error there can quote the private text it failed on.
 *   - Elsewhere a message is kept but emails, tokens, long numbers and Postgres "Failing row contains (...)" detail are
 *     redacted, and it is cut to 300 characters.
 *   - Paths keep their shape, with ids replaced by ":id".
 */

/** Routes whose errors may carry private text: messages are never reported from them. */
const PRIVATE_PATH = /^\/(?:(?:en|ar|ur)\/)?(?:api\/)?(?:admin\/)?(?:dreams|mufti|me|account|community\/questions|review-board)(?:\/|$)/;

export function isPrivatePath(path: string | undefined): boolean {
  return !!path && PRIVATE_PATH.test(path);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** "/api/dreams/3f2…?x=1" → "/api/dreams/:id". */
export function scrubPath(path: string | undefined): string {
  if (!path) return "";
  let p = path;
  try {
    p = new URL(path, "http://x").pathname;
  } catch {
    p = path.split(/[?#]/)[0] ?? "";
  }
  return p
    .replace(UUID, ":id")
    .split("/")
    .map((seg) => (/^\d{4,}$/.test(seg) || /^[A-Za-z0-9_-]{24,}$/.test(seg) ? ":id" : seg))
    .join("/")
    .slice(0, 200);
}

/** Redact personal data and quoted row content from a free-text message. */
export function scrubMessage(message: string | undefined, path?: string): string {
  if (!message) return "";
  if (isPrivatePath(path)) return "[withheld: private route]";
  return message
    .replace(/Failing row contains \(.*?\)\.?/gs, "Failing row contains (…).")
    .replace(/Key \(.*?\)=\(.*?\)/gs, "Key (…)=(…)")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[token]")
    .replace(/\b(?:sk|pk|rk|key|token|secret)[-_][A-Za-z0-9_-]{8,}/gi, "[secret]")
    .replace(/\b\d{7,}\b/g, "[number]")
    .replace(UUID, ":id")
    .slice(0, 300);
}

/** Stack frames only: the first line of a stack repeats the message, so it is dropped. */
export function scrubStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return stack
    .split("\n")
    .filter((l) => /^\s+at /.test(l))
    .slice(0, 30)
    .map((l) => l.replace(UUID, ":id"))
    .join("\n");
}

/** Only these keys may appear in a structured log line or an error's extra context. Values are short scalars. */
const SAFE_KEYS = new Set([
  "route",
  "path",
  "method",
  "status",
  "code",
  "bucket",
  "digest",
  "durationMs",
  "errorName",
  "kind",
  "runtime",
  "routeType",
  "renderSource",
  "store",
  "directive",
  "blocked",
  "count",
]);

export type SafeFields = Record<string, string | number | boolean | null>;

export function safeFields(fields: Record<string, unknown> | undefined, path?: string): SafeFields {
  const out: SafeFields = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    if (!SAFE_KEYS.has(k)) continue;
    if (k === "path" || k === "route") out[k] = scrubPath(String(v));
    else if (k === "blocked") out[k] = scrubBlockedUri(String(v));
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (typeof v === "string") out[k] = scrubMessage(v, path).slice(0, 120);
  }
  return out;
}

/** A CSP report's blocked URI, reduced to its origin (or a keyword such as "inline" or "eval"). */
export function scrubBlockedUri(v: string): string {
  if (!v) return "";
  if (/^[a-z-]+$/.test(v)) return v; // inline, eval, data, blob, self
  try {
    return new URL(v).origin;
  } catch {
    return "[invalid]";
  }
}
