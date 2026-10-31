"use client";

import "@/styles/reader.css";
import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { quranReaderStrings } from "@/lib/i18n/modules/quranReader";
import { searchSurahs, type AyahPos, type SurahIndexEntry } from "@/lib/quran-reader";

type Entry = SurahIndexEntry & { revelation?: string };

/**
 * The 114 surahs with search-as-you-type over the number and the Arabic, English and transliterated names (forgiving
 * of spelling and diacritics). The full list is server-rendered, so it works before scripts load; the result count is
 * announced politely. Juz starts are listed only when the reading divisions were imported (content/quran/structure.json).
 */
export function SurahIndex({ surahs, juz, locale = "en" }: { surahs: Entry[]; juz: AyahPos[] | null; locale?: string }) {
  const t = quranReaderStrings(locale).index;
  const id = useId();
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const shown = useMemo(() => searchSurahs(surahs, dq), [surahs, dq]);
  return (
    <>
      <div className="qr-find" role="search">
        <label htmlFor={`${id}-q`} className="zq-eyebrow">
          {t.findLabel}
        </label>
        <input
          id={`${id}-q`}
          className="zq-input"
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={t.placeholder}
          aria-describedby={`${id}-help ${id}-n`}
          aria-controls={`${id}-list`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span id={`${id}-help`} className="zq-meta">
          {t.findHelp}
        </span>
        <span id={`${id}-n`} className="zq-meta" role="status" aria-live="polite">
          {q.trim() ? t.results(shown.length) : ""}
        </span>
      </div>
      {shown.length ? (
        <ol id={`${id}-list`} className="zq-surahs" aria-label={t.surahs} data-testid="surah-list">
          {shown.map((s) => (
            <li key={s.number}>
              <Link href={`/quran/${s.number}`}>
                <span className="zq-order">{s.number}</span>
                <span>
                  <b lang="en">{s.name}</b>
                  <span className="zq-meta" style={{ display: "block" }}>
                    {s.english ? (
                      <>
                        <span lang="en">{s.english}</span> ·{" "}
                      </>
                    ) : null}
                    {t.ayat(s.ayahs)}
                    {s.revelation ? ` · ${s.revelation}` : ""}
                  </span>
                </span>
                <span lang="ar" dir="rtl" className="zq-jc-sar">
                  {s.arabic}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p id={`${id}-list`} className="zq-meta" data-testid="surah-none">
          {t.none}
        </p>
      )}
      {juz ? (
        <details className="qr-juz">
          <summary>{t.byJuz}</summary>
          <ol aria-label={t.byJuz}>
            {juz.map(([s, a], i) => (
              <li key={i}>
                <Link href={`/quran/${s}#ayah-${a}`}>
                  <b>{quranReaderStrings(locale).markers.juz(i + 1)}</b>
                  <span className="zq-meta" dir="ltr">{`Q ${s}:${a}`}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="zq-meta">{t.juzSource}</p>
        </details>
      ) : null}
    </>
  );
}
