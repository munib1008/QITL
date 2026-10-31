"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { storyChaptersStrings } from "@/lib/i18n/modules/storyChapters";
import { useLocale } from "@/lib/i18n/useLocale";
import { DEFAULT_MODE, MODE_PARAM, MODE_STORAGE_KEY, READER_MODES, parseMode, type ReaderMode } from "@/lib/stories/modes";

/**
 * The reading mode of a story: from ?mode= when present (a shared link keeps the mode), otherwise the mode this
 * viewer chose last (kept in this browser only; storage may be unavailable), otherwise the complete story.
 * Choosing writes both, without a navigation.
 */
export function useReaderMode(initial?: ReaderMode | null): [ReaderMode, (m: ReaderMode) => void] {
  const [mode, setMode] = useState<ReaderMode>(initial ?? DEFAULT_MODE);
  useEffect(() => {
    let fromUrl: ReaderMode | null = null;
    try {
      fromUrl = parseMode(new URLSearchParams(window.location.search).get(MODE_PARAM));
    } catch {
      fromUrl = null;
    }
    if (fromUrl) return setMode(fromUrl);
    if (initial) return;
    try {
      const stored = parseMode(window.localStorage.getItem(MODE_STORAGE_KEY));
      if (stored) setMode(stored);
    } catch {
      /* storage unavailable: the default stands */
    }
  }, [initial]);
  const choose = useCallback((m: ReaderMode) => {
    setMode(m);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, m);
    } catch {
      /* a convenience only */
    }
    try {
      const u = new URL(window.location.href);
      u.searchParams.set(MODE_PARAM, m);
      window.history.replaceState(window.history.state, "", u);
    } catch {
      /* ignore */
    }
  }, []);
  return [mode, choose];
}

/**
 * Mode switch: a radio group in the order of depth. Keyboard: arrow keys move and select (following the reading
 * direction), Home and End jump, Tab leaves the group. Modes without any reviewed text stay selectable (the reader
 * says so) but are marked.
 */
export function ReaderModeSwitch({ mode, onChange, empty }: { mode: ReaderMode; onChange: (m: ReaderMode) => void; empty?: Partial<Record<ReaderMode, boolean>> }) {
  const t = storyChaptersStrings(useLocale());
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
          data-empty={empty?.[m] ? "true" : undefined}
          title={t.modes[m][1]}
          onClick={() => onChange(m)}
          onKeyDown={(e) => move(e, i)}
        >
          {t.modes[m][0]}
        </button>
      ))}
    </div>
  );
}
