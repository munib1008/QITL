import type { Cue } from "./types";

const TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})/;

function ms(t: string): number | null {
  const m = TIME.exec(t.trim());
  if (!m) return null;
  return (Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000 + Number(m[4]);
}

/** Parse WebVTT captions (story_scenes.captions_vtt). Malformed blocks are skipped, never guessed. Markup is stripped. */
export function parseVtt(src: string | null | undefined): Cue[] {
  if (!src || !/^﻿?WEBVTT/.test(src)) return [];
  const cues: Cue[] = [];
  for (const block of src.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = block.split("\n").filter(Boolean);
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i]!.split("-->");
    const start = ms(a ?? "");
    const end = ms((b ?? "").trim().split(/\s+/)[0] ?? "");
    if (start === null || end === null || end <= start) continue;
    const text = lines
      .slice(i + 1)
      .join("\n")
      .replace(/<[^>]*>/g, "")
      .trim();
    if (text) cues.push({ startMs: start, endMs: end, text });
  }
  return cues.sort((x, y) => x.startMs - y.startMs);
}

export function cueAt(cues: Cue[], atMs: number): Cue | null {
  return cues.find((c) => atMs >= c.startMs && atMs < c.endMs) ?? null;
}
