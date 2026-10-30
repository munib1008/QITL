import type { Locale } from "../dict";

/**
 * Per-module interface strings, so modules built in parallel never edit the shared dict.ts.
 *
 *   // src/lib/i18n/modules/dreams.ts
 *   export const dreamStrings = (locale: string) => moduleStrings(locale, { en: {...}, ar: {...}, ur: {...} });
 *
 * English is required and is the shape; Arabic and Urdu are optional and may be partial: any missing key (at any
 * depth) falls back to English. Non-English strings are drafts until a qualified translator reviews them.
 */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : T[K] extends object ? DeepPartial<T[K]> : T[K] };

export interface ModuleStrings<T> {
  en: T;
  ar?: DeepPartial<T>;
  ur?: DeepPartial<T>;
}

function merge<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base;
  if (typeof base !== "object" || base === null || Array.isArray(base)) return (typeof over === typeof base ? over : base) as T;
  if (typeof over !== "object") return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(base as object)) out[k] = merge((base as Record<string, unknown>)[k], (over as Record<string, unknown>)[k]);
  return out as T;
}

export function moduleStrings<T extends object>(locale: Locale | string, strings: ModuleStrings<T>): T {
  if (locale === "ar") return merge(strings.en, strings.ar);
  if (locale === "ur") return merge(strings.en, strings.ur);
  return strings.en;
}
