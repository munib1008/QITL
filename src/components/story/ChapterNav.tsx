"use client";

import { useEffect, useState } from "react";
import { storyStrings } from "@/lib/i18n/modules/story";
import { useLocale } from "@/lib/i18n/useLocale";

export interface Chapter {
  id: string; // id of the section (or its heading) on the page
  label: string;
}

const KEY = "qitl-resume:";

/**
 * Sticky chapter progress for long reading pages: "Chapter n of N", previous / next chapter, a progress bar and
 * Resume reading (the last chapter this reader reached on this page, kept in this browser only; signed-in reading
 * progress is the account's job). Chapters missing from the page are skipped. Native scrolling only.
 */
export function ChapterNav({ chapters, storageKey }: { chapters: Chapter[]; storageKey: string }) {
  const t = storyStrings(useLocale());
  const [present, setPresent] = useState<Chapter[]>([]);
  const [current, setCurrent] = useState(0);
  const [resume, setResume] = useState<Chapter | null>(null);

  useEffect(() => {
    const list = chapters.filter((c) => document.getElementById(c.id));
    setPresent(list);
    if (!list.length) return;

    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY + storageKey);
    }
    catch {
      saved = null;
    }
    const savedIdx = list.findIndex((c) => c.id === saved);
    if (savedIdx > 0 && !location.hash) setResume(list[savedIdx]!);

    const els = list.map((c) => document.getElementById(c.id)!);
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.3;
        let idx = 0;
        els.forEach((el, i) => {
          if (el.getBoundingClientRect().top <= line) idx = i;
        });
        setCurrent(idx);
        if (idx > 0) {
          setResume(null);
          try {
            localStorage.setItem(KEY + storageKey, list[idx]!.id);
          }
          catch {
            /* storage unavailable: resume is a convenience only */
          }
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [chapters, storageKey]);

  if (present.length < 2) return null;
  const go = (i: number) => {
    const c = present[Math.max(0, Math.min(present.length - 1, i))];
    if (!c) return;
    const el = document.getElementById(c.id);
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    const h = el.matches("h2, h3") ? el : el.querySelector<HTMLElement>("h2, h3");
    if (h) {
      h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    }
  };
  const cur = present[current]!;
  const pct = present.length > 1 ? current / (present.length - 1) : 0;

  return (
    <nav className="qc-nav" aria-label={t.progress}>
      <button type="button" className="qc-btn" onClick={() => go(current - 1)} disabled={current === 0} aria-label={t.prevChapter}>
        <span aria-hidden="true">‹</span>
      </button>
      <div className="qc-mid">
        <span className="qc-count">
          {t.chapterOf(current + 1, present.length)}
        </span>
        <b className="qc-label">{cur.label}</b>
        <span className="qc-bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${pct})` }} />
        </span>
      </div>
      {resume ? (
        <button type="button" className="qc-resume" onClick={() => go(present.indexOf(resume))}>
          {t.resume} {resume.label}
        </button>
      ) : null}
      <button type="button" className="qc-btn" onClick={() => go(current + 1)} disabled={current === present.length - 1} aria-label={t.nextChapter}>
        <span aria-hidden="true">›</span>
      </button>
    </nav>
  );
}
