"use client";

import { useId } from "react";
import { getDict, LOCALES, resolveLocale, type Locale } from "@/lib/i18n";
import { NARRATION_LANGS, QURAN_TRANSLATION_LANGS, type NarrationLang, type QuranTranslationLang } from "@/lib/i18n/prefs";
import { useLanguagePrefs } from "@/lib/i18n/useLanguagePrefs";

const DIR: Record<string, "ltr" | "rtl"> = { en: "ltr", ar: "rtl", ur: "rtl" };

/**
 * Interface, Quran translation and narration language: three independent choices. Signed out they are kept on this
 * device (cookie + localStorage); signed in they are also saved to the account. `compact` is the reader's inline
 * version (Quran translation and narration only; the interface language is the header / Explore switch).
 */
export function LanguagePrefsPanel({ locale, compact = false }: { locale: string; compact?: boolean }) {
  const ui = resolveLocale(locale);
  const { t } = getDict(ui);
  const { prefs, setUi, setQuran, setNarration, saved } = useLanguagePrefs(ui);
  const id = useId();
  const name = (l: string) => (l === "none" ? t.prefs.arabicOnly : t.lang[l as Locale]);
  const opt = (l: string) => (
    <option key={l} value={l} lang={l === "none" ? undefined : l} dir={l === "none" ? undefined : DIR[l]}>
      {name(l)}
    </option>
  );

  return (
    <section className="pp-card" aria-labelledby={`${id}-h`} data-lang-prefs>
      <h2 id={`${id}-h`} className="zq-eyebrow">
        {t.prefs.title}
      </h2>
      <div className={compact ? "zq-prefs zq-prefs-compact" : "zq-prefs"}>
        {compact ? null : (
          <div className="zq-prefs-row">
            <label htmlFor={`${id}-ui`}>{t.prefs.interface}</label>
            <select id={`${id}-ui`} className="zq-input" value={ui} onChange={(e) => void setUi(resolveLocale(e.target.value))}>
              {LOCALES.map(opt)}
            </select>
          </div>
        )}
        <div className="zq-prefs-row">
          <label htmlFor={`${id}-q`}>{t.prefs.quran}</label>
          <select id={`${id}-q`} className="zq-input" value={prefs.quran} onChange={(e) => setQuran(e.target.value as QuranTranslationLang)}>
            {QURAN_TRANSLATION_LANGS.map(opt)}
          </select>
        </div>
        <div className="zq-prefs-row">
          <label htmlFor={`${id}-n`}>{t.prefs.narration}</label>
          <select id={`${id}-n`} className="zq-input" value={prefs.narration} onChange={(e) => setNarration(e.target.value as NarrationLang)}>
            {NARRATION_LANGS.map(opt)}
          </select>
        </div>
      </div>
      <p className="zq-prefs-note">{t.prefs.note}</p>
      <p className="zq-prefs-saved" role="status" aria-live="polite">
        {saved === "account" ? t.prefs.savedAccount : saved ? t.prefs.savedLocal : ""}
      </p>
    </section>
  );
}
