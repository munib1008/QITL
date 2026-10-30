import { resolveLocale, type Locale } from "./index";

/**
 * Three independent language preferences (docs/proposals/2026-10-31-briefs-review.md section 1):
 * - ui: the interface language (qitl-locale cookie; profiles.locale when signed in)
 * - quran: the language of the Quran translation shown under the Arabic ("none" = the Arabic alone)
 *   (story_playback_preferences.quran_translation_language when signed in)
 * - narration: the language of story narration (story_playback_preferences.language when signed in)
 * Signed-out readers keep quran and narration in localStorage (PREFS_STORAGE_KEY).
 * A preference never makes text appear: a translation or narration shows only when a licensed, reviewed edition
 * exists in that language; otherwise the reader falls back (English, then the Arabic alone).
 */
export const QURAN_TRANSLATION_LANGS = ["en", "ur", "none"] as const;
export const NARRATION_LANGS = ["en", "ar", "ur"] as const;
export type QuranTranslationLang = (typeof QURAN_TRANSLATION_LANGS)[number];
export type NarrationLang = (typeof NARRATION_LANGS)[number];

export interface LanguagePrefs {
  ui: Locale;
  quran: QuranTranslationLang;
  narration: NarrationLang;
}

export const PREFS_STORAGE_KEY = "qitl-lang-prefs";
export const PREFS_EVENT = "qitl-lang-prefs";

/** Defaults follow the interface language: an Urdu reader gets the Urdu translation, an Arabic reader the Arabic alone. */
export function defaultPrefs(ui: Locale | string): LanguagePrefs {
  const l = resolveLocale(ui);
  return { ui: l, quran: l === "ur" ? "ur" : l === "ar" ? "none" : "en", narration: l };
}

const isQuran = (v: unknown): v is QuranTranslationLang => typeof v === "string" && (QURAN_TRANSLATION_LANGS as readonly string[]).includes(v);
const isNarration = (v: unknown): v is NarrationLang => typeof v === "string" && (NARRATION_LANGS as readonly string[]).includes(v);

/** Stored or remote values merged over the defaults for `ui`; anything unknown or malformed is ignored. */
export function parsePrefs(raw: unknown, ui: Locale | string): LanguagePrefs {
  const d = defaultPrefs(ui);
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    }
    catch {
      return d;
    }
  }
  if (!v || typeof v !== "object") return d;
  const o = v as Record<string, unknown>;
  return { ui: d.ui, quran: isQuran(o.quran) ? o.quran : d.quran, narration: isNarration(o.narration) ? o.narration : d.narration };
}

/** The serialised local form (the interface language lives in the cookie, not here). */
export function serializePrefs(p: LanguagePrefs): string {
  return JSON.stringify({ quran: p.quran, narration: p.narration });
}

/**
 * Which edition language to show, given the preference and the languages actually available (licensed and reviewed).
 * Falls back to English, then to null (the Arabic alone / no narration).
 */
export function pickAvailable<T extends string>(want: T | "none", available: readonly string[]): T | "en" | null {
  if (want === "none") return null;
  if (available.includes(want)) return want;
  return available.includes("en") ? "en" : null;
}
