import type { Locale } from "./dict";

/** Locale constants and path helpers, without the dictionaries (the middleware imports only this). */
/** Interface languages. English is the default and the fallback for any missing string. */
export const LOCALES: Locale[] = ["en", "ar", "ur"];
export const DEFAULT_LOCALE: Locale = "en";
/** Right-to-left interface languages. */
export const RTL_LOCALES: readonly Locale[] = ["ar", "ur"];
/** Locales served under their own path prefix (/ar/..., /ur/...). English is unprefixed. */
export const PREFIXED_LOCALES: readonly Locale[] = ["ar", "ur"];

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as string[]).includes(v);
}

/** Any value (cookie, profile column, route segment) to a supported locale; unknown values fall back to English. */
export function resolveLocale(v: unknown): Locale {
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

export const LOCALE_COOKIE = "qitl-locale";

const PREFIX_RE = /^\/(en|ar|ur)(?=\/|$)/;

/** The public path without the internal /en, /ar or /ur locale segment (rewrites can expose any of them). */
export function stripLocale(path: string): string {
  return path.replace(PREFIX_RE, "") || "/";
}

/** The locale named by a path's first segment, or null for an unprefixed path. */
export function localeFromPath(path: string): Locale | null {
  const m = PREFIX_RE.exec(path);
  return m ? (m[1] as Locale) : null;
}

/** The public URL path of `path` in `locale`: English is unprefixed, Arabic and Urdu carry their prefix. */
export function localizedPath(path: string, locale: Locale): string {
  const p = stripLocale(path);
  if (!PREFIXED_LOCALES.includes(locale)) return p;
  return p === "/" ? `/${locale}` : `/${locale}${p}`;
}

/**
 * Attributes for English content shown inside an Arabic or Urdu page (database rows, editorial pages, names): marks it
 * lang="en" dir="ltr" so full stops land on the right side and screen readers switch voice. Nothing in English.
 */
export function englishContent(locale: string): { lang?: "en"; dir?: "ltr" } {
  return resolveLocale(locale) === "en" ? {} : { lang: "en", dir: "ltr" };
}
