/**
 * Reference verification for the Event Universe against the imported Quran text (content/quran/quran.txt, Tanzil
 * Uthmani). Node only (reads the file): used by tests, the inventory generator and the admin coverage page.
 *
 * An anchor is a single word (a name or a distinctive term) that must occur in the cited range. It is typed the way the
 * Uthmani text spells the word and matched on a light normal form (marks and hamza removed, see norm); a text word
 * matches when it is the anchor with an optional prefix and pronoun suffix. Anchors are search keys, not quoted text,
 * and are never shown to readers.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Ref {
  surah: number;
  from: number;
  to: number;
}

export type Quran = Map<string, string>;

let cache: Quran | null = null;

/** surah:ayah → the verse as imported. */
export function loadQuran(root = process.cwd()): Quran {
  if (cache) return cache;
  const text = readFileSync(join(root, "content", "quran", "quran.txt"), "utf8");
  const m: Quran = new Map();
  for (const line of text.split(/\r?\n/)) {
    const mm = /^(\d{1,3})\|(\d{1,3})\|(.+)$/.exec(line);
    if (mm) m.set(`${mm[1]}:${mm[2]}`, mm[3]!);
  }
  cache = m;
  return m;
}

/** Number of ayat in each surah, from the imported text. */
export function ayahCounts(q: Quran): number[] {
  const counts = new Array<number>(115).fill(0);
  for (const k of q.keys()) {
    const [s, a] = k.split(":").map(Number) as [number, number];
    counts[s] = Math.max(counts[s]!, a);
  }
  return counts;
}

export function parseRef(s: string): Ref | null {
  const m = /^(\d{1,3}):(\d{1,3})(?:[-–](\d{1,3}))?$/.exec(s.trim());
  if (!m) return null;
  const surah = Number(m[1]);
  const from = Number(m[2]);
  const to = m[3] ? Number(m[3]) : from;
  if (surah < 1 || surah > 114 || from < 1 || to < from) return null;
  return { surah, from, to };
}

export function formatRef(r: Ref): string {
  return r.from === r.to ? `${r.surah}:${r.from}` : `${r.surah}:${r.from}-${r.to}`;
}

/**
 * Light normal form: no diacritics or Quranic marks (dagger alef and small yeh included), one form per alef, ya and
 * ta marbuta, hamza and its carriers removed. Alef is kept, so an anchor is typed the way the Uthmani text spells the
 * word (a dagger alef is not written: هرون, not هارون).
 */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ءئؤ]/g, "");
}

const PREFIXES = ["", "و", "ف", "ب", "ل", "ك", "ال", "وال", "فال", "بال", "كال", "لل", "ولل", "ول", "فل", "وب", "فب", "وك", "ا", "سي", "س", "ي", "ت", "ن", "وي", "ويا", "فا", "في"].map(norm);
const SUFFIXES = ["", "ه", "ها", "هم", "هما", "ك", "كم", "نا", "ي", "ان", "ين", "ون", "ن", "ات", "ا", "وا", "تم", "ته"].map(norm);

/** The anchor as matched: normalised, without a leading article (the text may or may not carry one). */
export function anchorForm(anchor: string): string {
  const n = norm(anchor.trim());
  return n.startsWith("ال") && n.length > 4 ? n.slice(2) : n;
}

/** Does the normalised word w carry the anchor a, with an optional prefix and pronoun suffix? */
function wordHas(w: string, a: string): boolean {
  if (w === a) return true;
  for (const p of PREFIXES) {
    if (!w.startsWith(p)) continue;
    const rest = w.slice(p.length);
    if (rest === a) return true;
    for (const s of SUFFIXES) if (s && rest === a + s) return true;
  }
  return false;
}

/** Anchors need at least three letters, so they cannot match by accident. */
export function anchorOk(anchor: string): boolean {
  return anchor.split("/").every((a) => anchorForm(a).length >= 3);
}

/** `anchor` may list spelling variants separated by "/" (the text spells some names two ways). */
export function rangeHasAnchor(q: Quran, r: Ref, anchor: string): boolean {
  const alts = anchor.split("/").map(anchorForm);
  for (let i = r.from; i <= r.to; i++) {
    const v = q.get(`${r.surah}:${i}`);
    if (v === undefined) continue;
    for (const w of v.split(/\s+/)) {
      const n = norm(w);
      if (alts.some((a) => wordHas(n, a))) return true;
    }
  }
  return false;
}

/** Does the range exist in the text (every ayah present)? */
export function rangeExists(q: Quran, r: Ref): boolean {
  for (let i = r.from; i <= r.to; i++) if (!q.has(`${r.surah}:${i}`)) return false;
  return true;
}

/** Ayat covered by a set of ranges, as "surah:ayah" keys. */
export function ayatOf(refs: Ref[]): Set<string> {
  const s = new Set<string>();
  for (const r of refs) for (let i = r.from; i <= r.to; i++) s.add(`${r.surah}:${i}`);
  return s;
}
