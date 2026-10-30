"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/account/useSession";
import { LOCALE_COOKIE, localizedPath, resolveLocale, type Locale } from "./index";
import { PREFS_EVENT, PREFS_STORAGE_KEY, defaultPrefs, parsePrefs, serializePrefs, type LanguagePrefs, type NarrationLang, type QuranTranslationLang } from "./prefs";

export type PrefsSaved = "local" | "account" | "error" | null;

function readLocal(ui: Locale): LanguagePrefs {
  try {
    return parsePrefs(localStorage.getItem(PREFS_STORAGE_KEY), ui);
  }
  catch {
    return defaultPrefs(ui);
  }
}

function writeLocal(p: LanguagePrefs) {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, serializePrefs(p));
  }
  catch {
    // storage unavailable: the choice lasts for this page only
  }
  window.dispatchEvent(new CustomEvent(PREFS_EVENT));
}

/**
 * The reader's three language preferences. Signed out: localStorage (and the qitl-locale cookie for the interface).
 * Signed in: the same, mirrored to the account (profiles.locale, story_playback_preferences.language and
 * .quran_translation_language) and loaded from it on sign-in. Every instance on the page stays in sync.
 */
export function useLanguagePrefs(initialUi?: Locale) {
  const session = useSession();
  const [prefs, setPrefs] = useState<LanguagePrefs>(() => defaultPrefs(initialUi ?? "en"));
  const [saved, setSaved] = useState<PrefsSaved>(null);
  const userId = session.status === "signed_in" ? session.user.id : null;

  useEffect(() => {
    const ui = resolveLocale(initialUi ?? document.documentElement.lang);
    const sync = () => setPrefs(readLocal(ui));
    sync();
    window.addEventListener(PREFS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PREFS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [initialUi]);

  // Signed in: the account's choices win over this device's.
  useEffect(() => {
    if (!userId) return;
    let live = true;
    import("@/lib/supabase/browser").then(async ({ getBrowserSupabase }) => {
      const sb = getBrowserSupabase();
      if (!sb) return;
      const { data } = await sb.from("story_playback_preferences").select("language, quran_translation_language").eq("user_id", userId).maybeSingle();
      if (!live || !data) return;
      const row = data as { language?: string; quran_translation_language?: string };
      const next = parsePrefs({ narration: row.language, quran: row.quran_translation_language }, resolveLocale(document.documentElement.lang));
      writeLocal(next);
    });
    return () => {
      live = false;
    };
  }, [userId]);

  const saveRemote = useCallback(
    async (p: LanguagePrefs) => {
      if (!userId) {
        setSaved("local");
        return;
      }
      const { getBrowserSupabase } = await import("@/lib/supabase/browser");
      const sb = getBrowserSupabase();
      const r = await sb
        ?.from("story_playback_preferences")
        .upsert({ user_id: userId, language: p.narration, quran_translation_language: p.quran, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      setSaved(!sb || r?.error ? "error" : "account");
    },
    [userId],
  );

  const setQuran = useCallback(
    (quran: QuranTranslationLang) => {
      const next = { ...prefs, quran };
      setPrefs(next);
      writeLocal(next);
      void saveRemote(next);
    },
    [prefs, saveRemote],
  );

  const setNarration = useCallback(
    (narration: NarrationLang) => {
      const next = { ...prefs, narration };
      setPrefs(next);
      writeLocal(next);
      void saveRemote(next);
    },
    [prefs, saveRemote],
  );

  /** Interface language: cookie (read by the middleware), the profile when signed in, then a full navigation. */
  const setUi = useCallback(
    async (ui: Locale) => {
      setLocaleCookie(ui);
      if (userId) {
        const { getBrowserSupabase } = await import("@/lib/supabase/browser");
        await getBrowserSupabase()?.from("profiles").update({ locale: ui, updated_at: new Date().toISOString() }).eq("id", userId);
      }
      window.location.assign(localizedPath(window.location.pathname, ui) + window.location.search + window.location.hash);
    },
    [userId],
  );

  return { prefs, setUi, setQuran, setNarration, saved, signedIn: Boolean(userId) };
}

export function setLocaleCookie(l: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
}
