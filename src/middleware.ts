import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCALE_COOKIE, PREFIXED_LOCALES, localeFromPath, resolveLocale } from "@/lib/i18n/locales";

/**
 * 1. Locale: /ar/... is always Arabic and /ur/... always Urdu. Any other path is served in the language chosen with the
 *    language switch (cookie qitl-locale: en, ar or ur; English by default and for any unknown value) by rewriting to
 *    /en/..., /ar/... or /ur/... internally, so every link in the app stays a plain path and every variant is statically
 *    generated. /en/... chooses English (sets the cookie) and redirects to the unprefixed URL.
 * 2. Auth: refreshes the Supabase session cookie when Supabase is configured.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const prefix = localeFromPath(pathname);

  if (prefix === "en") {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    // The language switch links to /en/... to choose English: remember it, then serve the unprefixed URL.
    const r = NextResponse.redirect(url, 307);
    if (req.cookies.get(LOCALE_COOKIE)?.value !== "en") r.cookies.set(LOCALE_COOKIE, "en", { path: "/", maxAge: 31536000, sameSite: "lax" });
    return r;
  }

  let res: NextResponse;
  if (prefix && PREFIXED_LOCALES.includes(prefix)) {
    res = NextResponse.next({ request: req });
    // Opening an Arabic or Urdu link keeps the reader in that language on the next internal link.
    if (req.cookies.get(LOCALE_COOKIE)?.value !== prefix) res.cookies.set(LOCALE_COOKIE, prefix, { path: "/", maxAge: 31536000, sameSite: "lax" });
  }
  else {
    const locale = resolveLocale(req.cookies.get(LOCALE_COOKIE)?.value);
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    res = NextResponse.rewrite(url, { request: req });
  }

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

export const config = {
  // Pages only: not API routes, the auth callback, Next internals or files with an extension.
  matcher: ["/((?!api|auth|_next|.*\\..*).*)"],
};
