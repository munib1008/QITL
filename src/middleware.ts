import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCALE_COOKIE, PREFIXED_LOCALES, localeFromPath, resolveLocale } from "@/lib/i18n/locales";
import { CSP_REPORT_PATH, buildCsp, cspHeaderName, cspMode, makeNonce } from "@/lib/security/csp";
import { apiBucketFor, check, clientIp, rateLimitHeaders, tooManyRequests } from "@/lib/security/rate-limit";

/**
 * 1. API routes (/api/...): a per-IP sliding-window rate limit (src/lib/security/rate-limit.ts), 429 with Retry-After.
 *    Signed-in calls are limited per user again in requireUser (src/lib/api.ts).
 * 2. Pages, locale: /ar/... is always Arabic and /ur/... always Urdu. Any other path is served in the language chosen
 *    with the language switch (cookie qitl-locale: en, ar or ur; English by default and for any unknown value) by
 *    rewriting to /en/..., /ar/... or /ur/... internally, so every link in the app stays a plain path. /en/... chooses
 *    English (sets the cookie) and redirects to the unprefixed URL.
 * 3. Pages, Content Security Policy: a fresh nonce per request (src/lib/security/csp.ts). It goes on the request (so
 *    Next.js stamps its own scripts and the root layout stamps the theme script) and on the response header.
 * 4. Pages, auth: refreshes the Supabase session cookie when Supabase is configured.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/api" || pathname.startsWith("/api/")) return api(req);

  const prefix = localeFromPath(pathname);

  if (prefix === "en") {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    // The language switch links to /en/... to choose English: remember it, then serve the unprefixed URL.
    const r = NextResponse.redirect(url, 307);
    if (req.cookies.get(LOCALE_COOKIE)?.value !== "en") r.cookies.set(LOCALE_COOKIE, "en", { path: "/", maxAge: 31536000, sameSite: "lax" });
    return r;
  }

  const nonce = makeNonce();
  const policy = buildCsp({
    nonce,
    dev: process.env.NODE_ENV !== "production",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mapTilesUrl: process.env.NEXT_PUBLIC_MAP_TILES_URL,
    analyticsUrl: process.env.NEXT_PUBLIC_ANALYTICS_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    reportUri: CSP_REPORT_PATH,
  });
  const header = cspHeaderName(cspMode());
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(header, policy);

  let res: NextResponse;
  if (prefix && PREFIXED_LOCALES.includes(prefix)) {
    res = NextResponse.next({ request: { headers: requestHeaders } });
    // Opening an Arabic or Urdu link keeps the reader in that language on the next internal link.
    if (req.cookies.get(LOCALE_COOKIE)?.value !== prefix) res.cookies.set(LOCALE_COOKIE, prefix, { path: "/", maxAge: 31536000, sameSite: "lax" });
  }
  else {
    const locale = resolveLocale(req.cookies.get(LOCALE_COOKIE)?.value);
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }
  res.headers.set(header, policy);

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supaUrl && supaKey && req.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    const sb = createServerClient(supaUrl, supaKey, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value, options } of list) res.cookies.set(name, value, options);
        },
      },
    });
    await sb.auth.getUser();
  }
  return res;
}

/** Per-IP limits for the API: every request counts toward "api", and some also toward a tighter bucket. */
async function api(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req.headers);
  const general = await check("api", ip);
  if (!general.allowed) return limited(general);
  const extra = apiBucketFor(req.method, req.nextUrl.pathname);
  const specific = extra ? await check(extra, ip) : null;
  if (specific && !specific.allowed) return limited(specific);
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(rateLimitHeaders(specific ?? general))) res.headers.set(k, v);
  return res;
}

function limited(r: Parameters<typeof tooManyRequests>[0]): NextResponse {
  const res = tooManyRequests(r);
  return new NextResponse(res.body, { status: res.status, headers: res.headers });
}

export const config = {
  // Pages (not the auth callback, Next internals or files with an extension) and the API.
  matcher: ["/((?!api|auth|_next|.*\\..*).*)", "/api/:path*"],
};
