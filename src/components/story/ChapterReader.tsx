"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/story-chapters.css";
import { ChapterProgress } from "@/components/account/ChapterProgress";
import { NoteEditor } from "@/components/account/NoteEditor";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { Markdown } from "@/components/ui/Markdown";
import { ReaderModeSwitch, useReaderMode } from "./ReaderModeSwitch";
import { refLabel, type Ref } from "@/lib/data/story-types";
import { englishContent } from "@/lib/i18n/locales";
import { storyChaptersStrings } from "@/lib/i18n/modules/storyChapters";
import { useLocale } from "@/lib/i18n/useLocale";
import { chapterDomId, chapterVerseRefs, storySources, type ChapterData } from "@/lib/stories/chapters";
import { modeContent, modesWithText, type ReaderMode } from "@/lib/stories/modes";

const READ_KEY = "qitl-story-read:";

function RefChips({ refs }: { refs: Ref[] }) {
  return (
    <>
      {refs.map((r, i) => {
        const l = refLabel(r);
        return (
          <CitationChip key={i} href={l.href} kind={r.kind === "hadith" && r.hadith?.grade ? r.hadith.grade : undefined}>
            {l.text}
          </CitationChip>
        );
      })}
    </>
  );
}

/** A private note per chapter; the editor mounts only when opened, so a long story makes no request per chapter. */
function ChapterNotes({ chapterId }: { chapterId: string }) {
  const t = storyChaptersStrings(useLocale());
  const [open, setOpen] = useState(false);
  return (
    <details className="sc-notes" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>{t.notes}</summary>
      {open ? <NoteEditor target={{ type: "chapter", id: chapterId }} /> : null}
    </details>
  );
}

function ChapterList({ chapters, current, read, onGo }: { chapters: ChapterData[]; current: number; read: Set<string>; onGo: (c: ChapterData) => void }) {
  const t = storyChaptersStrings(useLocale());
  const en = englishContent(useLocale());
  return (
    <ol className="sc-list">
      {chapters.map((c, i) => (
        <li key={c.id}>
          <a
            href={`#${chapterDomId(c)}`}
            aria-current={i === current ? "location" : undefined}
            data-read={read.has(c.id) ? "true" : undefined}
            onClick={(e) => {
              e.preventDefault();
              onGo(c);
            }}
          >
            <span className="sc-list-n" aria-hidden="true">
              {read.has(c.id) ? "✓" : i + 1}
            </span>
            <span {...en}>{c.title}</span>
            {read.has(c.id) ? <span className="sr-only">{t.readMark}</span> : null}
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * A story as its chapters: the depth-mode switch, a sticky chapter list (a side column from 1024px, a bottom sheet on
 * phones), reading progress kept in this browser, and per chapter its own verse references, optional timeline event,
 * a collapsible sources panel and, last, "Sources and uncertainties". Text only ever comes from the reviewed chapter:
 * a mode without reviewed text says "not established", it is never filled in.
 */
export function ChapterReader({ slug, chapters, initialMode, initialPosition }: { slug: string; chapters: ChapterData[]; initialMode?: ReaderMode | null; initialPosition?: number | null }) {
  const locale = useLocale();
  const t = storyChaptersStrings(locale);
  const en = englishContent(locale);
  const [mode, choose] = useReaderMode(initialMode);
  const [current, setCurrent] = useState(0);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  const empty = useMemo(() => {
    const has = modesWithText(chapters);
    return { summary: !has.summary, complete: !has.complete, deep: !has.deep, kids: !has.kids, lessons: !has.lessons };
  }, [chapters]);

  // Reading progress: remembered per story in this browser only.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(READ_KEY + slug) ?? "[]") as unknown;
      if (Array.isArray(saved)) setRead(new Set(saved.filter((x): x is string => typeof x === "string")));
    } catch {
      /* storage unavailable or malformed: progress starts again */
    }
  }, [slug]);

  useEffect(() => {
    if (!chapters.length) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.3;
        let idx = 0;
        const passed: string[] = [];
        chapters.forEach((c, i) => {
          const el = document.getElementById(chapterDomId(c));
          if (!el) return;
          const r = el.getBoundingClientRect();
          if (r.top <= line) idx = i;
          if (r.bottom <= window.innerHeight * 0.6) passed.push(c.id);
        });
        setCurrent(idx);
        if (passed.length)
          setRead((prev) => {
            if (passed.every((id) => prev.has(id))) return prev;
            const next = new Set([...prev, ...passed]);
            try {
              window.localStorage.setItem(READ_KEY + slug, JSON.stringify([...next]));
            } catch {
              /* ignore */
            }
            return next;
          });
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [chapters, slug]);

  const go = useCallback(
    (c: ChapterData, updateHash = true) => {
      const el = document.getElementById(chapterDomId(c));
      if (!el) return;
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      const h = el.querySelector<HTMLElement>("h2");
      if (h) {
        h.setAttribute("tabindex", "-1");
        h.focus({ preventScroll: true });
      }
      if (updateHash) {
        try {
          window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${chapterDomId(c)}`);
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  // Older links used ?chapter=N.
  useEffect(() => {
    if (!initialPosition || window.location.hash) return;
    const c = chapters.find((x) => x.position === initialPosition);
    if (c) go(c, false);
  }, [initialPosition, chapters, go]);

  const closeSheet = () => {
    const d = dialog.current;
    if (d?.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    }
    setSheet(false);
    opener.current?.focus();
  };
  const openSheet = () => {
    const d = dialog.current;
    if (!d) return;
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
    setSheet(true);
  };

  if (!chapters.length) return <p className="zq-meta">{t.noChapters}</p>;

  const unknowns = chapters.filter((c) => c.unknownsMd?.trim());
  const sources = storySources(chapters);
  const list = <ChapterList chapters={chapters} current={current} read={read} onGo={(c) => (closeSheet(), go(c))} />;

  return (
    <div className="sc" data-mode={mode} data-testid="chapter-reader">
      <div className="sc-top">
        <ReaderModeSwitch mode={mode} onChange={choose} empty={empty} />
        <p className="zq-meta sc-note">{t.modeNote}</p>
      </div>

      <div className="sc-layout">
        <aside className="sc-side" aria-label={t.chapterNav}>
          <h2 className="zq-eyebrow">{t.chapters}</h2>
          <p className="zq-meta" role="status" data-testid="chapter-progress">
            {t.progress(read.size, chapters.length)}
          </p>
          <span className="sc-bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${read.size / chapters.length})` }} />
          </span>
          {list}
        </aside>

        <div className="sc-main">
          {chapters.map((c, i) => {
            const content = modeContent(c, mode);
            const verses = chapterVerseRefs(c);
            const id = chapterDomId(c);
            return (
              <article key={c.id} id={id} className="sc-chapter" aria-labelledby={`${id}-h`} data-testid="story-chapter" data-anchor={c.anchor}>
                <p className="sc-kicker">
                  <span>{t.chapterOf(i + 1, chapters.length)}</span>
                  {c.eventSlug ? (
                    <Link className="zq-chip" href={`/events/${c.eventSlug}`} data-testid="chapter-event">
                      {t.onTimeline}: <span {...en}>{c.eventTitle ?? c.eventSlug}</span>
                    </Link>
                  ) : null}
                </p>
                <h2 id={`${id}-h`} className="sc-h" {...en}>
                  {c.title}
                </h2>
                <p className="sc-link">
                  <a href={`#${id}`}>{t.linkToChapter}</a>
                </p>
                {verses.length ? (
                  <p className="sc-verses" aria-label={t.verses}>
                    <span className="zq-eyebrow">{t.verses}</span> <RefChips refs={verses} />
                  </p>
                ) : null}

                {content.state === "text" ? (
                  <div className="zq-prose type-reading sc-text" {...en} data-state="text">
                    {content.parts.map((p, k) => (
                      <Markdown key={k} source={p} />
                    ))}
                  </div>
                ) : (
                  <p className="sc-missing" role="note" data-state="missing">
                    {t.missing[mode]}
                  </p>
                )}
                {mode === "deep" && content.state === "text" && content.noExtra ? <p className="zq-meta">{t.deepNoExtra}</p> : null}
                {mode === "lessons" && content.state === "text" ? <p className="sc-label">{t.lessonsLabel}</p> : null}

                {c.unknownsMd?.trim() && (mode === "complete" || mode === "deep") ? (
                  <aside className="sc-unknowns" aria-label={t.notEstablishedHeading}>
                    <h3>{t.notEstablishedHeading}</h3>
                    <div {...en}>
                      <Markdown source={c.unknownsMd} />
                    </div>
                  </aside>
                ) : null}

                <details className="sc-sources" key={`${c.id}-${mode === "deep" ? "open" : "closed"}`} open={mode === "deep"}>
                  <summary>{t.sourcesCount(c.claims.length)}</summary>
                  {c.claims.length ? (
                    <ul className="sc-claims" aria-label={t.claimsHeading}>
                      {c.claims.map((cl) => (
                        <li key={cl.id} className="pp-card">
                          <p {...en}>{cl.statement}</p>
                          <div className="qs-refs">
                            <EvidenceLabel kind={cl.evidence} />
                            <RefChips refs={cl.refs} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="zq-meta">{t.noSources}</p>
                  )}
                </details>
                <ChapterNotes chapterId={c.id} />
                <ChapterProgress chapterId={c.id} elementId={id} />
              </article>
            );
          })}

          <section id="sources-and-uncertainties" className="sc-chapter sc-uncertain" aria-labelledby="sau-h" data-testid="sources-and-uncertainties">
            <h2 id="sau-h" className="sc-h">
              {t.uncertaintiesHeading}
            </h2>
            <p>{t.uncertaintiesIntro}</p>
            {unknowns.length ? (
              <ul className="sc-unknown-list">
                {unknowns.map((c) => (
                  <li key={c.id}>
                    <a href={`#${chapterDomId(c)}`} {...en}>
                      {c.title}
                    </a>
                    <div {...en}>
                      <Markdown source={c.unknownsMd!} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="zq-meta" data-testid="no-uncertainties">
                {t.uncertaintiesNone}
              </p>
            )}
            <h3>{t.allSources}</h3>
            {sources.length ? (
              <p className="qs-refs">
                <RefChips refs={sources} />
              </p>
            ) : (
              <p className="zq-meta">{t.noSources}</p>
            )}
            <p className="zq-meta">{t.reviewedNote}</p>
          </section>
        </div>
      </div>

      <div className="sc-bottom">
        <button ref={opener} type="button" className="zq-btn zq-btn-secondary sc-open" aria-haspopup="dialog" aria-expanded={sheet} onClick={openSheet}>
          {t.openChapters}: {t.chapterOf(current + 1, chapters.length)}
        </button>
      </div>
      <dialog ref={dialog} className="sc-sheet" aria-labelledby="sc-sheet-h" onClose={() => setSheet(false)} onCancel={() => setSheet(false)}>
        <div className="sc-sheet-head">
          <h2 id="sc-sheet-h" className="zq-eyebrow">
            {t.chapters}
          </h2>
          <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={closeSheet}>
            {t.closeChapters}
          </button>
        </div>
        <p className="zq-meta">{t.progress(read.size, chapters.length)}</p>
        {list}
      </dialog>
    </div>
  );
}
