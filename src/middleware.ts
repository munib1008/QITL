import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * 1. Locale: /ar/... is always Arabic. Any other path is served in the language chosen with the language toggle
 *    (cookie ziq-locale, English by default) by rewriting to /en/... or /ar/... internally, so every link in the app
 *    stays a plain path and both variants are statically generated. /en/... redirects to the unprefixed URL.
 * 2. Auth: refreshes the Supabase session cookie when Supabase is configured.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  let res: NextResponse;
  if (pathname === "/ar" || pathname.startsWith("/ar/")) {
    res = NextResponse.next({ request: req });
    // Opening an Arabic link keeps the reader in Arabic on the next internal link.
    if (req.cookies.get("ziq-locale")?.value !== "ar") res.cookies.set("ziq-locale", "ar", { path: "/", maxAge: 31536000, sameSite: "lax" });
  }
  else {
    const locale = req.cookies.get("ziq-locale")?.value === "ar" ? "ar" : "en";
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
