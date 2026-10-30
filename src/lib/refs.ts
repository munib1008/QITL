/** Canonical reference helpers. References are parsed, never invented. */

export interface AyahRef {
  surah: number;
  from: number;
  to: number;
}

/** "12:4" or "2:30–39" → {surah, from, to}. Returns null for anything else. */
export function parseAyahRange(s: string): AyahRef | null {
  const m = /^(\d{1,3}):(\d{1,3})(?:[–-](\d{1,3}))?$/.exec(s.trim().replace(/^Q\s*/, ""));
  if (!m) return null;
  const surah = Number(m[1]);
  const from = Number(m[2]);
  const to = m[3] ? Number(m[3]) : from;
  if (surah < 1 || surah > 114 || from < 1 || to < from) return null;
  return { surah, from, to };
}

/** Link target for an ayah range in the Quran explorer. */
export function quranHref(range: string): string | undefined {
  const r = parseAyahRange(range);
  return r ? `/quran/${r.surah}#ayah-${r.from}` : undefined;
}

export function formatAyah(r: AyahRef): string {
  return r.from === r.to ? `Q ${r.surah}:${r.from}` : `Q ${r.surah}:${r.from}–${r.to}`;
}
