"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/story-chapters.css";
import "@/styles/draft-preview.css";
import { CitationChip } from "@/components/ui/evidence";
import { Markdown } from "@/components/ui/Markdown";
import { englishContent } from "@/lib/i18n/locales";
import { draftPreviewStrings } from "@/lib/i18n/modules/draftPreview";
import { storyChaptersStrings } from "@/lib/i18n/modules/storyChapters";
import { useLocale } from "@/lib/i18n/useLocale";
import { quranHref } from "@/lib/refs";
import { chapterDomId, claimDomId, linkClaimMarkers, rangeAyat, rangeLabel, type PreviewChapter } from "@/lib/stories/draft-preview";
import { MODE_PARAM, READER_MODES, modeContent, parseMode, type ReaderMode } from "@/lib/stories/modes";

/** Ranges of up to this many ayat start open; longer ones start closed (the link and the count are always shown). */
const OPEN_UP_TO = 4;

function ModeSwitch({ mode, onChange }: { mode: ReaderMode; onChange: (m: ReaderMode) => void }) {
  const locale = useLocale();
  const t = draftPreviewStrings(locale);
  const labels = storyChaptersStrings(locale).modes;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (e: React.KeyboardEvent, i: number) => {
    const rtl = getComputedStyle(e.currentTarget as HTMLElement).direction === "rtl";
    let next = i;
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight") || e.key === "ArrowDown") next = (i + 1) % READER_MODES.length;
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft") || e.key === "ArrowUp") next = (i - 1 + READER_MODES.length) % READER_MODES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = READER_MODES.length - 1;
    else return;
    e.preventDefault();
    onChange(READER_MODES[next]!);
    refs.current[next]?.focus();
  };
  return (
    <div className="sc-modes" role="radiogroup" aria-label={t.modeSwitch} data-testid="reader-modes">
      {READER_MODES.map((m, i) => (
        <button
          key={m}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={mode === m}
          tabIndex={mode === m ? 0 : -1}
          className="zq-pill sc-mode"
          data-mode={m}
          title={t.modeTitles[m]}
          onClick={() => onChange(m)}
          onKeyDown={(e) => move(e, i)}
        >
          {labels[m][0]}
        </button>
      ))}
    </div>
  );
}

function CitedAyat({ chapter, quran }: { chapter: PreviewChapter; quran: Record<string, string> }) {
  const locale = useLocale();
  const t = draftPreviewStrings(locale);
  const id = chapterDomId(chapter.anchor);
  return (
    <section aria-labelledby={`${id}-cited`} data-testid="cited-ayat">
      <h3 id={`${id}-cited`} className="zq-eyebrow">
        {t.citedAyat}
      </h3>
      <ul className="dp-ayat">
        {chapter.verses.map((r) => {
          const label = rangeLabel(r);
          const ayat = rangeAyat({ quran }, r);
          return (
            <li key={label} className="dp-range" data-range={label}>
              <details open={ayat.length <= OPEN_UP_TO}>
                <summary>
                  <span dir="ltr">{t.ayahLabel(label)}</span>
                  <span className="zq-meta">{t.showArabic}</span>
                </summary>
                <p className="dp-range-links">
                  <CitationChip href={quranHref(label)} ariaLabel={`${t.openInReader}: ${t.ayahLabel(label)}`}>
                    {label}
                  </CitationChip>
                </p>
                {ayat.map((a) => (
                  <div key={a.ayah} className="dp-ayah" data-ayah={`${r.surah}:${a.ayah}`}>
                    <span className="dp-ayah-n" dir="ltr">
                      {r.surah}:{a.ayah}
                    </span>
                    <p className="zq-ar-quran" lang="ar" dir="rtl">
                      {a.text}
                    </p>
                  </div>
                ))}
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * A draft story as its chapters: depth-mode switch (?mode=, arrow keys), a chapter list, one anchor per chapter, the cited
 * ayat with their Arabic text, claims in a collapsible "Evidence for this chapter", what the sources do not establish,
 * and the story-level open points. The text is the drafter's English, rendered as plain Markdown (no HTML); claim markers
 * become links to the claim. A mode without text says so; nothing is filled in. The draft banner is rendered by the page.
 */
export function DraftReader({ chapters, quran, uncertainties, initialMode }: { chapters: PreviewChapter[]; quran: Record<string, string>; uncertainties: string[]; initialMode: ReaderMode }) {
  const locale = useLocale();
  const t = draftPreviewStrings(locale);
  const en = englishContent(locale);
  const [mode, setMode] = useState<ReaderMode>(initialMode);

  useEffect(() => {
    try {
      const m = parseMode(new URLSearchParams(window.location.search).get(MODE_PARAM));
      if (m) setMode(m);
    } catch {
      /* the server's mode stands */
    }
  }, []);

  const choose = useCallback((m: ReaderMode) => {
    setMode(m);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set(MODE_PARAM, m);
      window.history.replaceState(window.history.state, "", u);
    } catch {
      /* ignore */
    }
  }, []);

  // A link to a claim (a marker in the text, or #claim-… from outside) opens the evidence panel that holds it.
  useEffect(() => {
    const reveal = () => {
      let id = "";
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      if (!id.startsWith("claim-")) return;
      const el = document.getElementById(id);
      const panel = el?.closest("details");
      if (!el || !panel) return;
      if (!panel.open) panel.open = true;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      el.focus({ preventScroll: true });
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [mode]);

  const parts = useMemo(
    () =>
      chapters.map((c) =>
        modeContent({ summaryMd: c.summary_md, bodyMd: c.body_md, deepMd: c.deep_md, kidsMd: c.kids_md, lessonsMd: c.lessons_md }, mode),
      ),
    [chapters, mode],
  );

  return (
    <div className="sc" data-mode={mode} data-testid="draft-reader">
      <div className="sc-top">
        <ModeSwitch mode={mode} onChange={choose} />
        <p className="zq-meta sc-note">{t.modeNote}</p>
      </div>

      <details className="sc-sources" data-testid="draft-chapter-list">
        <summary>
          {t.chapters} ({chapters.length})
        </summary>
        <ol className="sc-list">
          {chapters.map((c, i) => (
            <li key={c.anchor}>
              <a href={`#${chapterDomId(c.anchor)}`}>
                <span className="sc-list-n" aria-hidden="true">
                  {i + 1}
                </span>
                <span {...en}>{c.title_en}</span>
              </a>
            </li>
          ))}
        </ol>
      </details>

      <div className="sc-main">
        {chapters.map((c, i) => {
          const content = parts[i]!;
          const id = chapterDomId(c.anchor);
          return (
            <article key={c.anchor} id={id} className="sc-chapter" aria-labelledby={`${id}-h`} data-testid="draft-chapter" data-anchor={c.anchor}>
              <p className="sc-kicker">
                <span>{t.chapterOf(i + 1, chapters.length)}</span>
                <span className="dp-chapter-badge">
                  {t.draftWord} · {t.reviewPending}
                </span>
              </p>
              <h2 id={`${id}-h`} className="sc-h" {...en}>
                {c.title_en}
              </h2>
              <p className="sc-link">
                <a href={`#${id}`}>{t.linkToChapter}</a>
              </p>

              {content.state === "text" ? (
                <div className="zq-prose type-reading sc-text dp-text" {...en} data-state="text">
                  {content.parts.map((p, k) => (
                    <Markdown key={k} source={linkClaimMarkers(p, c.anchor)} />
                  ))}
                </div>
              ) : (
                <p className="sc-missing" role="note" data-state="missing">
                  {t.missing}
                </p>
              )}
              {mode === "lessons" && content.state === "text" ? <p className="sc-label">{t.lessonsLabel}</p> : null}

              {c.unknowns_md.trim() ? (
                <aside className="sc-unknowns" aria-label={t.unknowns}>
                  <h3>{t.unknowns}</h3>
                  <div {...en}>
                    <Markdown source={c.unknowns_md} />
                  </div>
                </aside>
              ) : null}

              <CitedAyat chapter={c} quran={quran} />

              <details className="sc-sources" key={`${c.anchor}-${mode === "deep" ? "open" : "closed"}`} open={mode === "deep"} data-testid="chapter-evidence">
                <summary>{t.evidenceCount(c.claims.length)}</summary>
                <p className="zq-meta dp-claims-intro">{t.claimsIntro}</p>
                <ul className="sc-claims" aria-label={t.evidence}>
                  {c.claims.map((cl) => (
                    <li key={cl.id} id={claimDomId(c.anchor, cl.id)} tabIndex={-1} className="pp-card dp-claim" data-claim={cl.id}>
                      <p {...en}>
                        <span className="dp-claim-id" dir="ltr">
                          {cl.id}
                        </span>{" "}
                        {cl.statement_en}
                      </p>
                      <div className="qs-refs">
                        {cl.verses.map((r) => {
                          const label = rangeLabel(r);
                          return (
                            <CitationChip key={label} href={quranHref(label)}>
                              {label}
                            </CitationChip>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          );
        })}

        <section id="open-points" className="sc-chapter dp-uncertain" aria-labelledby="open-points-h" data-testid="open-points">
          <h2 id="open-points-h" className="sc-h">
            {t.uncertainties}
          </h2>
          <p>{t.uncertaintiesIntro}</p>
          {uncertainties.length ? (
            <ul className="sc-unknown-list" {...en}>
              {uncertainties.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          ) : (
            <p className="zq-meta">{t.uncertaintiesNone}</p>
          )}
        </section>
      </div>
    </div>
  );
}
