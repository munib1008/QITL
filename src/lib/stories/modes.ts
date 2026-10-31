/**
 * Depth modes of a story chapter. Pure. The chapter keeps one text per mode; a mode without reviewed text yields the
 * "not established" state, never a fallback invented from another mode (the kids mode and the summary in particular
 * are not abbreviations of the complete text, so they are not derived from it).
 */
export const READER_MODES = ["summary", "complete", "deep", "kids", "lessons"] as const;
export type ReaderMode = (typeof READER_MODES)[number];

export const MODE_PARAM = "mode";
export const MODE_STORAGE_KEY = "qitl-story-mode";
export const DEFAULT_MODE: ReaderMode = "complete";

export function parseMode(v: string | null | undefined): ReaderMode | null {
  return (READER_MODES as readonly string[]).includes(v ?? "") ? (v as ReaderMode) : null;
}

export interface ModeTexts {
  summaryMd: string | null;
  bodyMd: string;
  deepMd: string | null;
  kidsMd: string | null;
  lessonsMd: string | null;
}

export type ModeContent =
  | { state: "text"; parts: string[]; /** deep mode with no extra notes */ noExtra?: boolean }
  | { state: "missing" };

const has = (s: string | null | undefined): s is string => !!s && s.trim().length > 0;

export function modeContent(c: ModeTexts, mode: ReaderMode): ModeContent {
  switch (mode) {
    case "summary":
      return has(c.summaryMd) ? { state: "text", parts: [c.summaryMd] } : { state: "missing" };
    case "complete":
      return has(c.bodyMd) ? { state: "text", parts: [c.bodyMd] } : { state: "missing" };
    case "deep": {
      const parts = [c.bodyMd, c.deepMd].filter(has);
      if (!parts.length) return { state: "missing" };
      return { state: "text", parts, noExtra: !has(c.deepMd) };
    }
    case "kids":
      return has(c.kidsMd) ? { state: "text", parts: [c.kidsMd] } : { state: "missing" };
    case "lessons":
      return has(c.lessonsMd) ? { state: "text", parts: [c.lessonsMd] } : { state: "missing" };
  }
}

/** Modes that have reviewed text in at least one chapter of the story (the switch marks the others as empty). */
export function modesWithText(chapters: ModeTexts[]): Record<ReaderMode, boolean> {
  return Object.fromEntries(READER_MODES.map((m) => [m, chapters.some((c) => modeContent(c, m).state === "text")])) as Record<ReaderMode, boolean>;
}
