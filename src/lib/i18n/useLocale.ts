"use client";

import * as navigation from "next/navigation";
import type { Locale } from "./dict";
import { resolveLocale } from "./locales";

/**
 * The interface language in a client component: the [locale] route segment (the middleware rewrites every page to
 * /en|ar|ur/...), English outside the localised tree (or where no router is mounted, as in unit tests that stub
 * next/navigation). Server components get the locale from their params instead.
 */
export function useLocale(): Locale {
  let p: { locale?: string } | null = null;
  try {
    p = navigation.useParams<{ locale?: string }>();
  } catch {
    p = null;
  }
  return resolveLocale(p?.locale);
}
