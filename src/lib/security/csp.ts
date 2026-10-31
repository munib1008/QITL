/**
 * Content Security Policy, built per request by the middleware (src/middleware.ts) with a fresh nonce.
 *
 * Scripts: only those carrying this request's nonce ('nonce-…'), plus what they load ('strict-dynamic'). Next.js puts
 * the nonce on its own framework and hydration scripts when it finds it in the request's CSP header, and the root
 * layout puts it on the pre-paint theme script. No 'unsafe-inline' for scripts, no third-party script origins.
 * 'unsafe-eval' only in development (React refresh).
 *
 * Styles keep 'unsafe-inline': React style attributes and next/font need it, and a nonce would disable it.
 *
 * Network: connect/img/media are limited to this site, the Supabase project (from NEXT_PUBLIC_SUPABASE_URL; its
 * realtime websocket too), the map tile server (NEXT_PUBLIC_MAP_TILES_URL) and, only when analytics is turned on, the
 * analytics endpoint's origin. Nothing else.
 *
 * Mode (CSP_MODE): "enforce" (default) sends Content-Security-Policy; "report-only" sends
 * Content-Security-Policy-Report-Only (used to trial a policy change before enforcing it). Violations are reported to
 * /api/csp-report either way.
 */

export type CspMode = "enforce" | "report-only";

export interface CspInput {
  nonce: string;
  dev?: boolean;
  supabaseUrl?: string;
  mapTilesUrl?: string;
  analyticsUrl?: string;
  siteUrl?: string;
  reportUri?: string;
}

export const CSP_REPORT_PATH = "/api/csp-report";

/** The origin of a URL, or "" when it is empty or not an http(s) URL. */
export function originOf(url: string | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : "";
  } catch {
    return "";
  }
}

/** A random, unguessable nonce (128 bits, base64). Works in the Edge runtime and in Node. */
export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function cspMode(value = process.env.CSP_MODE): CspMode {
  return value === "report-only" ? "report-only" : "enforce";
}

export function cspHeaderName(mode: CspMode): string {
  return mode === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}

export function buildCsp(i: CspInput): string {
  if (!/^[A-Za-z0-9+/=]{16,}$/.test(i.nonce)) throw new Error("buildCsp: the nonce must be base64, at least 16 characters");
  const supabase = originOf(i.supabaseUrl);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : "";
  const tiles = originOf(i.mapTilesUrl);
  const analytics = originOf(i.analyticsUrl);
  const list = (...xs: string[]) => xs.filter(Boolean).join(" ");
  const https = (i.siteUrl ?? "").startsWith("https://");

  return [
    "default-src 'self'",
    `script-src ${list("'self'", `'nonce-${i.nonce}'`, "'strict-dynamic'", i.dev ? "'unsafe-eval'" : "")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${list("'self'", "data:", "blob:", supabase, tiles)}`,
    "font-src 'self'",
    `connect-src ${list("'self'", supabase, supabaseWs, tiles, analytics, i.dev ? "ws:" : "")}`,
    `media-src ${list("'self'", "blob:", supabase)}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // Only on an https site: on plain-http localhost it would break the service worker and assets.
    ...(!i.dev && https ? ["upgrade-insecure-requests"] : []),
    ...(i.reportUri ? [`report-uri ${i.reportUri}`] : []),
  ].join("; ");
}

/** The static policy for responses the middleware does not handle (API JSON, route handlers, files): nothing runs. */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/** The script-src directive of a policy, for tests and the report endpoint. */
export function directive(policy: string, name: string): string | undefined {
  return policy
    .split(";")
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
}
