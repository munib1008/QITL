"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LOCALES, localizedPath, stripLocale, type Locale } from "@/lib/i18n";
import { setLocaleCookie } from "@/lib/i18n/useLanguagePrefs";

export interface LangLabels {
  label: string;
  en: string;
  ar: string;
  ur: string;
}

/**
 * EN / العربية / اردو: a three-way switch of plain links (44px targets). /ar/... and /ur/... set the qitl-locale cookie in
 * the middleware; English goes through /en/..., which sets the cookie to en and redirects to the unprefixed URL, so the
 * switch works without JavaScript. With JavaScript the cookie is also set before the full navigation (html lang/dir
 * and fonts change with the language).
 */
export function LangToggle({ locale, labels, variant = "header" }: { locale: Locale; labels: LangLabels; variant?: "header" | "sheet" }) {
  const path = stripLocale(usePathname() ?? "/");
  const [query, setQuery] = useState("");
  useEffect(() => setQuery(window.location.search), [path]);
  return (
    <div className={`zq-lang zq-lang-${variant}`} role="group" aria-label={labels.label}>
      {LOCALES.map((l) => (
        <a
          key={l}
          href={(l === "en" ? (path === "/" ? "/en" : `/en${path}`) : localizedPath(path, l)) + query}
          lang={l}
          dir={l === "en" ? "ltr" : "rtl"}
          hrefLang={l}
          className="zq-lang-opt"
          aria-current={l === locale ? "true" : undefined}
          onClick={() => setLocaleCookie(l)}
        >
          {labels[l]}
        </a>
      ))}
    </div>
  );
}

type Theme = "system" | "light" | "dark";

/** Light / dark / system. Persists per viewer in localStorage; the layout applies it before first paint. */
export function ThemeToggle({ labels }: { labels: { label: string; light: string; dark: string; system: string } }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("qitl-theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {
      // storage unavailable: stay on system
    }
  }, []);
  const cycle = () => {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem("qitl-theme");
      else localStorage.setItem("qitl-theme", next);
    } catch {
      // ignore
    }
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
  };
  return (
    <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={cycle} aria-label={`${labels.label}: ${labels[theme]}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx={8} cy={8} r={5.5} fill="none" stroke="currentColor" strokeWidth={1.5} />
        <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
      </svg>
      <span className="zq-hide-sm">{labels[theme]}</span>
    </button>
  );
}
