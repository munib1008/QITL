"use client";

import "@/styles/reader.css";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { quranReaderStrings } from "@/lib/i18n/modules/quranReader";

/**
 * "Go to an ayah": a labelled surah select and ayah number, submitted with Enter or the Go button. In the current surah
 * it moves to #ayah-N (the 3-second highlight follows); otherwise it opens /quran/S#ayah-N. The G key (outside text
 * fields) focuses it. Errors are announced next to the field, never as a silent no-op.
 */
export function JumpToAyah({ surahs, current, locale = "en" }: { surahs: Array<{ number: number; name: string; ayahs: number }>; current?: number; locale?: string }) {
  const t = quranReaderStrings(locale).jump;
  const id = useId();
  const router = useRouter();
  const [surah, setSurah] = useState(current ?? 1);
  const [ayah, setAyah] = useState("");
  const [error, setError] = useState<string | null>(null);
  const select = useRef<HTMLSelectElement>(null);
  const max = surahs[surah - 1]?.ayahs ?? 286;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "g" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector("[role='dialog'][aria-modal='true']")) return;
      e.preventDefault();
      select.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      className="qr-jump"
      aria-labelledby={`${id}-h`}
      data-testid="jump-to-ayah"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const a = ayah.trim() === "" ? 1 : Number(ayah);
        if (!Number.isInteger(surah) || surah < 1 || surah > 114) return setError(t.errSurah);
        if (!Number.isInteger(a) || a < 1 || a > max) return setError(t.errAyah(max));
        setError(null);
        const hash = `#ayah-${a}`;
        if (surah === current) {
          if (window.location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
          else window.location.hash = hash;
          document.getElementById(`ayah-${a}`)?.focus({ preventScroll: true });
        } else router.push(`/quran/${surah}${hash}`);
      }}
    >
      <h2 id={`${id}-h`} className="qr-sr">
        {t.title}
      </h2>
      <div className="zq-field">
        <label htmlFor={`${id}-s`}>{t.surah}</label>
        <select
          id={`${id}-s`}
          ref={select}
          className="zq-input"
          value={surah}
          onChange={(e) => {
            setSurah(Number(e.target.value));
            setError(null);
          }}
        >
          {surahs.map((s) => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="zq-field">
        <label htmlFor={`${id}-a`}>{t.ayah}</label>
        <input
          id={`${id}-a`}
          className="zq-input"
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          placeholder={t.help(max)}
          value={ayah}
          dir="ltr"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-e` : undefined}
          onChange={(e) => {
            setAyah(e.target.value);
            setError(null);
          }}
        />
      </div>
      <button type="submit" className="zq-btn zq-btn-primary">
        {t.go}
      </button>
      <p id={`${id}-e`} className="zq-error qr-jump-err" role="alert" hidden={!error}>
        {error}
      </p>
    </form>
  );
}
