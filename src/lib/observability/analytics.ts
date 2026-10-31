/**
 * Privacy-safe analytics hook. OFF by default: nothing is sent unless NEXT_PUBLIC_ANALYTICS_URL is set at build time.
 *
 * When on, it sends only aggregate-friendly events to that endpoint (an Umami/Plausible-style collector, or your own):
 *   { event, path, locale } — the path with ids replaced by ":id" and no query string; no cookies, no identifiers,
 *   no referrer, no user agent fields, no free text. Event names and property values come from fixed lists.
 * It never sends from private sections (dreams, mufti, account, admin, review boards, sign-in) and respects
 * Do Not Track and Global Privacy Control. The collector origin is added to the CSP connect-src only when set.
 */
import { isPrivatePath, scrubPath } from "./scrub";

export const ANALYTICS_EVENTS = ["pageview", "search", "language_switch", "theme_switch", "player_start", "share"] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

const NEVER_TRACK = /^\/(?:(?:en|ar|ur)\/)?(?:admin|sign-in|auth|player-fixture)(?:\/|$)/;

export function analyticsUrl(env: Record<string, string | undefined> = { NEXT_PUBLIC_ANALYTICS_URL: process.env.NEXT_PUBLIC_ANALYTICS_URL }): string | null {
  const v = env.NEXT_PUBLIC_ANALYTICS_URL;
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.hostname === "localhost" ? u.toString() : null;
  } catch {
    return null;
  }
}

export interface AnalyticsPayload {
  event: AnalyticsEvent;
  path: string;
  locale: "en" | "ar" | "ur";
  /** A value from a fixed list (e.g. a facet name, "ar"/"ur"), never user text. */
  value?: string;
}

/** The payload for an event, or null when it must not be sent. Pure, for tests. */
export function payload(event: string, path: string, opts: { value?: string; dnt?: boolean } = {}): AnalyticsPayload | null {
  if (opts.dnt) return null;
  if (!(ANALYTICS_EVENTS as readonly string[]).includes(event)) return null;
  if (isPrivatePath(path) || NEVER_TRACK.test(path)) return null;
  const clean = scrubPath(path);
  const m = clean.match(/^\/(ar|ur)(?:\/|$)/);
  const value = opts.value && /^[a-z0-9_-]{1,32}$/.test(opts.value) ? opts.value : undefined;
  return { event: event as AnalyticsEvent, path: clean, locale: (m?.[1] as "ar" | "ur") ?? "en", ...(value ? { value } : {}) };
}

function doNotTrack(): boolean {
  if (typeof navigator === "undefined") return true;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return n.doNotTrack === "1" || n.globalPrivacyControl === true;
}

/** Send one event. A no-op when analytics is off, on the server, or when the reader opted out. */
export function track(event: AnalyticsEvent, opts: { value?: string; path?: string } = {}): void {
  const url = analyticsUrl();
  if (!url || typeof window === "undefined") return;
  const p = payload(event, opts.path ?? window.location.pathname, { value: opts.value, dnt: doNotTrack() });
  if (!p) return;
  try {
    const body = new Blob([JSON.stringify(p)], { type: "application/json" });
    if (!navigator.sendBeacon?.(url, body)) void fetch(url, { method: "POST", body, keepalive: true, credentials: "omit" }).catch(() => undefined);
  } catch {
    // Analytics must never break a page.
  }
}
