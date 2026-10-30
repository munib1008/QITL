"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** EN · ع: stores the choice in a cookie (read by the middleware) and reloads the page in that language. */
export function LangToggle({ locale, label }: { locale: "en" | "ar"; label: string }) {
  const router = useRouter();
  const next = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      className="zq-btn zq-btn-quiet zq-btn-sm"
      aria-label={`${label}: ${next === "ar" ? "العربية" : "English"}`}
      onClick={() => {
        document.cookie = `qitl-locale=${next}; path=/; max-age=31536000; samesite=lax`;
        const path = window.location.pathname.replace(/^\/ar(?=\/|$)/, "") || "/";
        if (window.location.pathname !== path) router.push(path);
        router.refresh();
      }}
    >
      EN · <span lang="ar">ع</span>
    </button>
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
