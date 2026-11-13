"use client";

import "@/styles/reader.css";
import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { quranDivisionStrings } from "@/lib/i18n/modules/quranDivision";
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
      <div className="qs toolbar qr-find" role="search">
        <label htmlFor={`${id}-q`} className="sr-only">
          {t.findLabel}
        </label>
        <div className="field">
          <Icon.search />
          <input
            id={`${id}-q`}
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder={t.placeholder}
            aria-describedby={`${id}-help ${id}-n`}
            aria-controls={`${id}-list`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span id={`${id}-help`} className="count" style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--font-sans)", fontSize: 13 }}>
          {t.findHelp}
        </span>
        <span id={`${id}-n`} className="sr-only" role="status" aria-live="polite">
          {q.trim() ? t.results(shown.length) : ""}
        </span>
      </div>
      {shown.length ? (
        <ol id={`${id}-list`} className="qs sgrid" aria-label={t.surahs} data-testid="surah-list">
          {shown.map((s) => (
            <li key={s.number} style={{ display: "contents" }}>
              <Link className="stile" href={`/quran/${s.number}`}>
                <span className="dnum">{s.number}</span>
                <span>
                  <b lang="en">{s.name}</b>
                  <small>
                    {s.english ? (
                      <>
                        <span lang="en">{s.english}</span> ·{" "}
                      </>
                    ) : null}
                    {t.ayat(s.ayahs)}
                    {s.revelation ? ` · ${s.revelation}` : ""}
                  </small>
                </span>
                <span lang="ar" dir="rtl" className="ar">
                  {s.arabic}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="qs empty2" id={`${id}-list`} data-testid="surah-none">
          <b>{t.none}</b>
        </div>
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
                </Link>{" "}
                <Link className="zq-meta" href={`/quran/juz/${i + 1}`} aria-label={`${quranReaderStrings(locale).markers.juz(i + 1)} (${quranDivisionStrings(locale).juzNav})`}>
                  ↗
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
