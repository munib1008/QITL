import { dict } from "./dict";
import { dirOf, resolveLocale } from "./locales";

export { type Locale } from "./dict";
export { moduleStrings, type ModuleStrings } from "./modules";
export * from "./locales";

/**
 * Interface language: the [locale] route segment, chosen by the middleware from /ar/..., /ur/... or the qitl-locale cookie.
 * Content language is set per block with lang/dir.
 */
export function getDict(locale: string) {
  const l = resolveLocale(locale);
  return { locale: l, dir: dirOf(l), t: dict[l] };
}

/** The "draft, needs review by a qualified translator" notice for this interface language, or "" for English. */
export function draftNotice(t: ReturnType<typeof getDict>["t"]): string {
  return t.draftUrduUi || t.draftArabicUi;
}
