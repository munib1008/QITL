import { dict, type Locale } from "./dict";

export { type Locale } from "./dict";
export const LOCALES: Locale[] = ["en", "ar"];

export function isLocale(v: string): v is Locale {
  return (LOCALES as string[]).includes(v);
}

/**
 * Interface language: the [locale] route segment, chosen by the middleware from /ar/... or the ziq-locale cookie.
 * Content language is set per block with lang/dir.
 */
export function getDict(locale: string) {
  const l: Locale = locale === "ar" ? "ar" : "en";
  return { locale: l, dir: l === "ar" ? ("rtl" as const) : ("ltr" as const), t: dict[l] };
}

export const LOCALE_COOKIE = "ziq-locale";

/** The public path without the internal /en or /ar locale segment (rewrites can expose either). */
export function stripLocale(path: string): string {
  return path.replace(/^\/(en|ar)(?=\/|$)/, "") || "/";
}
