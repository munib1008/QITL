"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookmarkButton } from "@/components/account/BookmarkButton";
import { CitationChip } from "@/components/ui/evidence";
import { Icon } from "@/components/ui/icons";
import { interpretationT } from "@/lib/i18n/modules/interpretation";
import { StudyLayout, type StudyTarget } from "./StudyPanel";

const SIZES = [24, 28, 32, 38, 44, 48];

/**
 * The ayah reader. Arabic is user-scalable 24–48px (remembered per reader), never truncated or letter-spaced.
 * Each ayah has a persistent anchor (#ayah-N), a bookmark, a copyable citation and a "Study" button that opens the
 * Interpretation Explorer (bottom sheet on phones, docked panel beside the text on desktop).
 */
export function AyahReader({ surah, surahName, verses, links, locale = "en" }: { surah: number; surahName: string; verses: Array<{ ayah: number; text: string }>; links: Record<number, Array<{ id: string; name: string }>>; locale?: string }) {
  const [size, setSize] = useState(32);
  const [study, setStudy] = useState<StudyTarget | null>(null);
  const t = interpretationT(locale);
  const [copied, setCopied] = useState<number | null>(null);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem("qitl-quran-size"));
      if (SIZES.includes(v)) setSize(v);
    } catch {
      // storage unavailable
    }
  }, []);
  const set = (v: number) => {
    setSize(v);
    try {
      localStorage.setItem("qitl-quran-size", String(v));
    } catch {
      // ignore
    }
  };
  const i = SIZES.indexOf(size);
  return (
    <StudyLayout target={study} locale={locale} onClose={() => setStudy(null)}>
    <section aria-label={`Surah ${surahName}, Arabic text`}>
      <div className="zq-filters" role="group" aria-label="Arabic text size" style={{ marginBottom: 12 }}>
        <span className="zq-eyebrow">Text size</span>
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => set(SIZES[Math.max(0, i - 1)]!)} disabled={i <= 0} aria-label="Smaller Arabic text">
          A−
        </button>
        <output className="zq-order" aria-live="polite">
          {size}px
        </output>
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => set(SIZES[Math.min(SIZES.length - 1, i + 1)]!)} disabled={i >= SIZES.length - 1} aria-label="Larger Arabic text">
          A+
        </button>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {verses.map((v) => (
          <li key={v.ayah} id={`ayah-${v.ayah}`} className="zq-ayah" style={{ scrollMarginTop: 24 }}>
            <p className="zq-ar-quran" lang="ar" dir="rtl" style={{ fontSize: size, maxWidth: "var(--measure-arabic)" }}>
              {v.text}
            </p>
            <div className="zq-actions" role="group" aria-label={`Ayah ${v.ayah}`}>
              <CitationChip href={`#ayah-${v.ayah}`}>{`Q ${surah}:${v.ayah}`}</CitationChip>
              <button
                type="button"
                className="zq-iconbtn qs-study-btn"
                aria-haspopup="dialog"
                aria-pressed={study?.ayah === v.ayah}
                aria-label={t.studyAyah(`Q ${surah}:${v.ayah}`)}
                onClick={() => setStudy({ surah, ayah: v.ayah, arabic: v.text, related: links[v.ayah] ?? [] })}
              >
                <Icon.source />
                {t.study}
              </button>
              <BookmarkButton target={{ type: "quran_verse", id: `${surah}:${v.ayah}` }} variant="icon" />
              <button
                type="button"
                className="zq-iconbtn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`Q ${surah}:${v.ayah}`);
                    setCopied(v.ayah);
                    setTimeout(() => setCopied(null), 1500);
                  } catch {
                    // ignore
                  }
                }}
              >
                {copied === v.ayah ? <Icon.check /> : <Icon.copy />}
                {copied === v.ayah ? "Copied" : "Copy reference"}
              </button>
              {(links[v.ayah] ?? []).map((l) => (
                <Link key={l.id} className="zq-iconbtn" href={`/prophets/${l.id}`}>
                  {l.name} →
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
    </StudyLayout>
  );
}
