"use client";

import { useEffect, useState } from "react";
import { getDict, resolveLocale } from "@/lib/i18n";
import { readerStrings } from "@/lib/i18n/modules/reader";
import { pickAvailable } from "@/lib/i18n/prefs";
import { useLanguagePrefs } from "@/lib/i18n/useLanguagePrefs";
import { LanguagePrefsPanel } from "@/components/account/LanguagePrefsPanel";

/**
 * What the reader's language preference gives on this page: the Quran translation (kind="quran") or story narration
 * (kind="narration"). `available` lists the languages with a licensed, reviewed edition here; none are cleared yet,
 * so today it says the chosen language is unavailable (never shows unlicensed or unreviewed text). The compact
 * preferences panel opens in place, so signed-out readers can change it without an account (stored on the device).
 */
export function LanguageNote({ kind, available = [] }: { kind: "quran" | "narration"; available?: readonly string[] }) {
  const [ui, setUi] = useState(resolveLocale(undefined));
  useEffect(() => setUi(resolveLocale(document.documentElement.lang)), []);
  const { prefs } = useLanguagePrefs(ui);
  const s = readerStrings(ui);
  const { t } = getDict(ui);
  const want = kind === "quran" ? prefs.quran : prefs.narration;
  const got = pickAvailable(want, available);
  const wantName = want === "none" ? t.prefs.arabicOnly : t.lang[want];
  let text: string;
  if (kind === "quran" && want === "none") text = s.arabicOnly;
  else if (got) text = `${kind === "quran" ? s.translation : s.narration}: ${t.lang[got]}`;
  else text = `${kind === "quran" ? s.translation : s.narration} (${wantName}): ${kind === "quran" ? s.unavailable : s.noNarration}`;
  return (
    <div className="zq-langnote" data-language-note={kind} data-language-want={want}>
      <p className="zq-meta">{text}</p>
      <details className="zq-langnote-more">
        <summary className="zq-btn zq-btn-quiet zq-btn-sm">{s.change}</summary>
        <LanguagePrefsPanel locale={ui} compact />
      </details>
    </div>
  );
}
