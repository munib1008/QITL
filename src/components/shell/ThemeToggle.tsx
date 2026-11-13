"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { hudStrings } from "@/lib/i18n/modules/hud";
import { useLocale } from "@/lib/i18n/useLocale";
import { THEME_COOKIE } from "@/lib/theme";

/**
 * Light / dark switch. The choice is kept in a cookie that the locale layout reads on the server, so the first paint
 * already has the right theme (no flash, no inline script). With no choice the site is light.
 */
export function ThemeToggle() {
  const t = hudStrings(useLocale()).theme;
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setDark(!dark);
  }
  return (
    <button type="button" className="iconbtn" onClick={toggle} aria-label={dark ? t.toLight : t.toDark} aria-pressed={dark}>
      {dark ? <Icon.sun /> : <Icon.moon />}
    </button>
  );
}
