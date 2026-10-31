/**
 * Pure helpers for the Quran reader (server and client). Nothing here holds, edits or normalises Quran text: copy
 * and share pass the verified ayah string through untouched and only add the reference, attribution and link.
 */

export type AyahPos = [number, number];

/** Reading divisions (from Tanzil's quran-data.js via content/quran/structure.json): the first ayah of each. */
export interface QuranDivisions {
  juz: AyahPos[];
  hizbQuarters: AyahPos[];
  pages: AyahPos[];
}

/** What starts at an ayah: a juz, a hizb quarter (1 = the hizb itself, 2 = ¼, 3 = ½, 4 = ¾) and/or a page. */
export interface AyahMarker {
  juz?: number;
  hizb?: { hizb: number; quarter: 1 | 2 | 3 | 4 };
  page?: number;
}

/** Division starts inside one surah, keyed by ayah. */
export function markersForSurah(d: QuranDivisions, surah: number): Record<number, AyahMarker> {
  const out: Record<number, AyahMarker> = {};
  d.juz.forEach(([s, a], i) => {
    if (s === surah) (out[a] ??= {}).juz = i + 1;
  });
  d.hizbQuarters.forEach(([s, a], i) => {
    if (s === surah) (out[a] ??= {}).hizb = { hizb: Math.floor(i / 4) + 1, quarter: ((i % 4) + 1) as 1 | 2 | 3 | 4 };
  });
  d.pages.forEach(([s, a], i) => {
    if (s === surah) (out[a] ??= {}).page = i + 1;
  });
  return out;
}

/** The juz and page an ayah falls in (the last division starting at or before it). */
export function divisionOf(list: AyahPos[], surah: number, ayah: number): number {
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const [s, a] = list[i]!;
    if (s < surah || (s === surah && a <= ayah)) n = i + 1;
    else break;
  }
  return n;
}

/* ------------------------------------------------------------------ jump to an ayah */

/**
 * What a reader typed into "Go to": "2:255", "Q 2:255", "2 255", "2.255" → surah and ayah; "36" → surah 36 (ayah 1).
 * Only numbers are parsed. `counts[s-1]` is the ayah count of surah s; out-of-range input returns an error code.
 */
export function parseJump(input: string, counts: number[] | null): { surah: number; ayah: number } | { error: "empty" | "format" | "surah" | "ayah" } {
  const v = input.trim().replace(/^Q\s*/i, "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
  if (!v) return { error: "empty" };
  const m = /^(\d{1,3})(?:\s*[:.\s/]\s*(\d{1,3}))?$/.exec(v);
  if (!m) return { error: "format" };
  const surah = Number(m[1]);
  const ayah = m[2] ? Number(m[2]) : 1;
  if (surah < 1 || surah > 114) return { error: "surah" };
  const max = counts?.[surah - 1] ?? 286;
  if (ayah < 1 || ayah > max) return { error: "ayah" };
  return { surah, ayah };
}

/* ------------------------------------------------------------------ surah index search */

export interface SurahIndexEntry {
  number: number;
  name: string; // transliteration
  arabic: string;
  english?: string;
  ayahs: number;
}

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Arabic search key: no diacritics or tatweel, the alif forms folded, alif maqsura as ya, ta marbuta as ha. */
export function arabicKey(s: string): string {
  return s
    .replace(TASHKEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, "");
}

/**
 * Latin search key, forgiving of the many spellings of a transliteration: lower case, letters and digits only,
 * doubled letters collapsed, e→i and o→u, and a final h dropped ("Al-Baqarah", "baqara", "Yaseen", "yasin").
 */
export function latinKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/(.)\1+/g, "$1")
    .replace(/e/g, "i")
    .replace(/o/g, "u")
    .replace(/h$/, "");
}

const latinKeyNoArticle = (s: string) => latinKey(s.replace(/^(a[lnrstdzsh]{1,2}|aal)-/i, ""));

/** Surahs matching a query over number, transliteration, English and Arabic names, best matches first. */
export function searchSurahs<T extends SurahIndexEntry>(list: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return list;
  if (/^\d{1,3}$/.test(q)) return list.filter((s) => String(s.number).startsWith(q)).sort((a, b) => (a.number === Number(q) ? -1 : b.number === Number(q) ? 1 : a.number - b.number));
  const ar = /[؀-ۿ]/.test(q) ? arabicKey(q) : "";
  const la = latinKey(q);
  const scored: Array<{ s: T; score: number }> = [];
  for (const s of list) {
    let score = 0;
    if (ar) {
      const k = arabicKey(s.arabic);
      if (k === ar) score = 3;
      else if (k.startsWith(ar) || k.replace(/^ال/, "").startsWith(ar.replace(/^ال/, ""))) score = 2;
      else if (k.includes(ar)) score = 1;
    } else if (la) {
      const name = latinKey(s.name);
      const bare = latinKeyNoArticle(s.name);
      const en = s.english ? latinKey(s.english) : "";
      if (name === la || bare === la) score = 3;
      else if (name.startsWith(la) || bare.startsWith(la) || en.startsWith(la)) score = 2;
      else if (name.includes(la) || en.includes(la)) score = 1;
    }
    if (score) scored.push({ s, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.s.number - b.s.number).map((x) => x.s);
}

/* ------------------------------------------------------------------ copy and share */

export interface SourceLike {
  source: string;
  version: string;
  url: string;
}

/** The one-line Tanzil attribution carried with every copied or shared ayah. */
export function attributionLine(src: SourceLike): string {
  return `Arabic text: ${src.source}, version ${src.version.replace(/^Uthmani\s*/, "")}, Tanzil Project (${src.url.replace(/\/$/, "")}), CC BY 3.0, reproduced verbatim.`;
}

/**
 * The text placed on the clipboard (or in a share sheet) for one ayah: the verified Arabic exactly as given, then
 * "Q s:a" with the surah name, the attribution line and the link. The Arabic is never trimmed or rewritten.
 */
export function ayahShareText(o: { arabic: string; surah: number; ayah: number; surahName?: string; attribution: string; url?: string }): string {
  const ref = `Q ${o.surah}:${o.ayah}${o.surahName ? ` (${o.surahName})` : ""}`;
  return o.url ? [o.arabic, ref, o.attribution, o.url].join("\n") : [o.arabic, ref, o.attribution].join("\n");
}

/** The ayah under the reading line: the first one whose bottom edge is below `topOffset` px from the viewport top. */
export function ayahAtLine(rects: Array<{ ayah: number; top: number; bottom: number }>, topOffset: number): number | null {
  let lo = 0;
  let hi = rects.length - 1;
  let found: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rects[mid]!.bottom > topOffset) {
      found = rects[mid]!.ayah;
      hi = mid - 1;
    } else lo = mid + 1;
  }
  return found;
}

/* ------------------------------------------------------------------ reading progress (this device) */

export const PROGRESS_KEY = "qitl-quran-progress-v1";

export interface ProgressEntry {
  surah: number;
  ayah: number;
  at: string; // ISO time
}
export interface LocalProgress {
  last: ProgressEntry | null;
  surahs: Record<string, ProgressEntry>;
}

const empty = (): LocalProgress => ({ last: null, surahs: {} });

function valid(e: unknown): e is ProgressEntry {
  const x = e as ProgressEntry;
  return !!x && Number.isInteger(x.surah) && x.surah >= 1 && x.surah <= 114 && Number.isInteger(x.ayah) && x.ayah >= 1 && x.ayah <= 286 && typeof x.at === "string";
}

/** Parses what is stored on this device; anything malformed is dropped rather than trusted. */
export function parseProgress(raw: string | null): LocalProgress {
  if (!raw) return empty();
  try {
    const v = JSON.parse(raw) as Partial<LocalProgress>;
    const out = empty();
    if (valid(v.last)) out.last = { surah: v.last.surah, ayah: v.last.ayah, at: v.last.at };
    for (const [k, e] of Object.entries(v.surahs ?? {})) if (valid(e) && String(e.surah) === k) out.surahs[k] = { surah: e.surah, ayah: e.ayah, at: e.at };
    return out;
  } catch {
    return empty();
  }
}

export function recordProgress(p: LocalProgress, surah: number, ayah: number, at = new Date().toISOString()): LocalProgress {
  const e = { surah, ayah, at };
  return { last: e, surahs: { ...p.surahs, [String(surah)]: e } };
}

export function readLocalProgress(): LocalProgress {
  try {
    return parseProgress(window.localStorage.getItem(PROGRESS_KEY));
  } catch {
    return empty();
  }
}

export function saveLocalProgress(surah: number, ayah: number): LocalProgress {
  const next = recordProgress(readLocalProgress(), surah, ayah);
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode): progress is simply not kept
  }
  return next;
}
