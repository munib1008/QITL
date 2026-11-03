import raw from "@content/asma/names.draft.json";

/**
 * The commonly taught list of Names from the registry draft, for the Names dial when the database is not connected.
 * AI draft, not reviewed: the page says so. No count is stored here (the dial counts what it is given) and nothing here
 * claims the Names are limited to a number.
 */
export interface DialName {
  slug: string;
  vowelled: string;
  transliteration: string;
  meaning: string | null;
  draft: boolean;
}

interface Row {
  slug: string;
  v: string;
  tr: string;
  en: string;
  mar: string;
  ur: string;
}

export function draftDialNames(locale: string): DialName[] {
  return (raw.names as Row[]).map((n) => ({ slug: n.slug, vowelled: n.v, transliteration: n.tr, meaning: locale === "ar" ? n.mar : locale === "ur" ? n.ur : n.en, draft: true }));
}
