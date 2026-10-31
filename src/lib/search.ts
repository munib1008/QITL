import { journeyStops, type JourneyItem } from "@/content/journey";

/*
 * QITL search: normalisation and matching shared by every source (journey, Quran, static pages, database index).
 * Pure functions only; the server-side sources live in src/lib/search-sources.ts and the merge in search-engine.ts.
 * Search never generates text: every title and snippet shown is the source's own text.
 */

// Tashkeel, Quranic annotation marks, small letters, tatweel. Mirrors public.normalize_arabic (migration 2200).
const ARABIC_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D3-\u08FF]/g;
const ARABIC_FOLD: Record<string, string> = {
  "\u0623": "\u0627", // أ
  "\u0625": "\u0627", // إ
  "\u0622": "\u0627", // آ
  "\u0671": "\u0627", // ٱ alef wasla
  "\u0649": "\u064A", // ى
  "\u0629": "\u0647", // ة
  "\u0624": "\u0648", // ؤ
  "\u0626": "\u064A", // ئ
  // Urdu / Persian letter forms, so an Urdu query finds the Arabic spelling (یوسف → يوسف).
  "\u06CC": "\u064A", // ی
  "\u06D2": "\u064A", // ے
  "\u06D3": "\u064A", // ۓ
  "\u06A9": "\u0643", // ک
  "\u06C1": "\u0647", // ہ
  "\u06C2": "\u0647", // ۂ
  "\u06C3": "\u0647", // ۃ
  "\u06BE": "\u0647", // ھ
};
const ARABIC_FOLD_RE = new RegExp(`[${Object.keys(ARABIC_FOLD).join("")}]`, "g");
// Arabic-Indic and Extended (Urdu) digits → ASCII, so "١٢:٤" is a reference.
const DIGITS_RE = /[\u0660-\u0669\u06F0-\u06F9]/g;

/** Strip tashkeel, Quranic marks and tatweel; fold alef, ya, ta marbuta, hamza seats and Urdu letter forms. */
export function normalizeArabic(s: string): string {
  return s
    .normalize("NFC")
    .replace(ARABIC_MARKS, "")
    .replace(ARABIC_FOLD_RE, (c) => ARABIC_FOLD[c] ?? c)
    .replace(DIGITS_RE, (d) => String((d.codePointAt(0)! - 0x0660) % 0x90));
}

/** Fold transliteration marks and apostrophes, lowercase. Mirrors public.normalize_latin. */
export function normalizeLatin(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ʿʾ'’‘`-]/g, "")
    .toLowerCase();
}

export const normalize = (s: string) => normalizeLatin(normalizeArabic(s)).replace(/\s+/g, " ").trim();

const ARABIC_LETTER = /[\u0600-\u06FF]/;
export const hasArabicScript = (s: string) => ARABIC_LETTER.test(s);

/** Words of a normalised string: hyphenated names give their parts and the joined form ("al-baqara" → al, baqara, albaqara). */
export function tokens(s: string): string[] {
  const out = new Set<string>();
  const base = normalizeArabic(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  for (const word of base.split(/[\s.,;:!?()[\]{}"“”«»،؛؟/|]+/)) {
    if (!word) continue;
    const joined = word.replace(/[ʿʾ'’‘`-]/g, "");
    if (joined) out.add(joined);
    for (const part of word.split(/[-ʿʾ'’‘`]+/)) if (part && part !== joined) out.add(part);
  }
  return [...out];
}

/**
 * A spelling key for transliterated names: long vowels and doubled letters fold, a final "h" after a vowel drops.
 * Yousuf / Yusuf / Yoosuf, Baqarah / Baqara and Ismaeel / Ismail share a key.
 */
export function nameKey(token: string): string {
  if (hasArabicScript(token)) return token;
  return token
    .replace(/ou|oo|uu/g, "u")
    .replace(/ee|ii/g, "i")
    .replace(/ae|aa/g, "a")
    .replace(/ph/g, "f")
    .replace(/(.)\1+/g, "$1")
    .replace(/([aeiou])h$/, "$1");
}

/** Optimal string alignment distance (Levenshtein plus one transposition), stopping early once it exceeds max. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array<number>(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let cur = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j]!;
    [prev, cur] = [cur, prev];
  }
  return prev[b.length]!;
}

/** Typo allowance by length: none under 4 letters, one up to 7, two from 8. */
export const typoBudget = (len: number) => (len < 4 ? 0 : len < 8 ? 1 : 2);

/**
 * How well one query term matches one field's words, 0..1. `fuzzy` allows typos and spelling keys (names, titles);
 * body text only matches exactly, by prefix or as a substring.
 */
export function termScore(term: string, words: string[], fuzzy: boolean): number {
  let best = 0;
  const tKey = nameKey(term);
  for (const w of words) {
    if (w === term) return 1;
    if (fuzzy && nameKey(w) === tKey) best = Math.max(best, 0.9);
    else if (term.length >= 2 && w.startsWith(term)) best = Math.max(best, 0.75);
    else if (term.length >= 3 && w.includes(term)) best = Math.max(best, 0.5);
    else if (fuzzy && best < 0.55) {
      const budget = typoBudget(term.length);
      if (budget) {
        const d = editDistance(nameKey(w), tKey, budget);
        if (d <= budget) best = Math.max(best, d === 1 ? 0.55 : 0.4);
      }
    }
  }
  return best;
}

export interface Field {
  text: string;
  /** Title-like (names, titles, aliases): weighted 3 and typo tolerant. Body text: weighted 1, exact only. */
  title?: boolean;
}

/**
 * Score a document for a query: every term must match some field (AND), the score sums each term's best weighted
 * match, and a title equal to the whole query earns a bonus. 0 means no match.
 */
export function scoreFields(query: string, fields: Field[]): number {
  const terms = tokensForQuery(query);
  if (!terms.length) return 0;
  const prepared = fields.filter((f) => f.text).map((f) => ({ words: tokens(f.text), weight: f.title ? 3 : 1, fuzzy: !!f.title, norm: normalize(f.text) }));
  let total = 0;
  for (const t of terms) {
    let best = 0;
    for (const f of prepared) best = Math.max(best, f.weight * termScore(t, f.words, f.fuzzy));
    if (best === 0) return 0;
    total += best;
  }
  const nq = normalize(query);
  if (prepared.some((f) => f.weight === 3 && f.norm === nq)) total += 2;
  return total;
}

/** Query terms: normalised words, without duplicates; the joined form of a hyphenated word only. */
export function tokensForQuery(q: string): string[] {
  const out: string[] = [];
  for (const word of normalize(q).split(/[\s.,;:!?()[\]{}"“”«»،؛؟/|]+/)) if (word && !out.includes(word)) out.push(word);
  return out;
}

export type Facet =
  | "prophets"
  | "milestones"
  | "quran"
  | "ayahs"
  | "stories"
  | "events"
  | "places"
  | "hadith"
  | "creation"
  | "guidance"
  | "lifestyle"
  | "qiraat"
  | "questions"
  | "pages"
  | "last_hour";

/** Display order of the facet filters. */
export const FACETS: Facet[] = ["prophets", "milestones", "quran", "ayahs", "stories", "events", "hadith", "creation", "guidance", "lifestyle", "qiraat", "questions", "last_hour", "places", "pages"];
export const isFacet = (s: string): s is Facet => (FACETS as string[]).includes(s);

export interface SearchHit {
  type: string;
  id: string;
  url: string;
  title: string;
  titleAr?: string;
  snippet: string;
  /** Verbatim Quran Arabic (ayah hits only); shown with the Tanzil attribution. */
  arabic?: string;
  facet: Facet;
  score: number;
}

/**
 * Widely used English and Arabic-transliteration forms of the prophets' names, so "Abraham" finds Ibrahim.
 * Keys are journey stop ids. Only established English Bible-tradition and common transliterated forms.
 */
export const ALIASES: Record<string, string[]> = {
  adam: ["adam"],
  nuh: ["noah", "nooh"],
  ibrahim: ["abraham", "ebrahim"],
  lut: ["lot", "loot"],
  ismail: ["ishmael", "ismael"],
  ishaq: ["isaac"],
  yaqub: ["jacob", "yakub"],
  yusuf: ["joseph", "yousuf", "yousef"],
  ayyub: ["job", "ayub"],
  shuayb: ["shuaib", "shoaib"],
  musa: ["moses", "moosa", "harun", "aaron", "haroon"],
  dawud: ["david", "dawood", "daud"],
  sulayman: ["solomon", "sulaiman", "suleiman"],
  ilyas: ["elijah", "elias"],
  alyasa: ["elisha"],
  yunus: ["jonah", "younus"],
  zakariya: ["zechariah", "zakariyya", "zakaria"],
  yahya: ["john"],
  isa: ["jesus", "eesa"],
  idris: ["enoch"],
  dhulkifl: ["dhul kifl", "zulkifl"],
};

/**
 * Other names to search the database index with: a query naming a prophet by an alias also searches the canonical
 * name ("Joseph" → "yusuf"), and the canonical name its English form ("yusuf" → "joseph").
 */
export function aliasExpansions(q: string): string[] {
  const terms = tokensForQuery(q);
  const out = new Set<string>();
  for (const [id, names] of Object.entries(ALIASES)) {
    const all = [id, ...names.map((n) => normalizeLatin(n).replace(/\s+/g, ""))];
    const keys = all.map(nameKey);
    if (terms.some((t) => keys.includes(nameKey(t)))) for (const n of [id, ...names]) if (!terms.includes(normalizeLatin(n))) out.add(n);
  }
  return [...out].slice(0, 6);
}

/** Markdown and whitespace out of a snippet; the words stay as the source wrote them. */
export function plainSnippet(s: string, max = 220): string {
  const t = s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** "12:4", "Q 2:255", "2:30-39", "١٢:٤" → a reference, or null. */
export function parseReference(q: string): { surah: number; from: number; to: number } | null {
  const m = /^(?:q(?:uran)?\s*)?(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*[–-]\s*(\d{1,3}))?$/i.exec(normalizeArabic(q).trim());
  if (!m) return null;
  const surah = Number(m[1]);
  const from = Number(m[2]);
  const to = m[3] ? Number(m[3]) : from;
  if (surah < 1 || surah > 114 || from < 1 || to < from || to - from > 50) return null;
  return { surah, from, to };
}

function stopFields(s: JourneyItem): Field[] {
  return [
    { text: s.name, title: true },
    { text: s.arabicName, title: true },
    { text: (ALIASES[s.id] ?? []).join(" "), title: true },
    { text: s.id, title: true },
    { text: [s.subtitle, s.summary, s.era.label, s.place?.name].filter(Boolean).join(" ") },
    { text: (s.surahs ?? []).flatMap((x) => [x.name, x.arabic, ...x.passages]).join(" ") },
  ];
}

/** Search the journey content (always available; it ships with the app). */
export function searchJourney(q: string): SearchHit[] {
  const nq = normalize(q);
  if (nq.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const s of journeyStops()) {
    const score = scoreFields(q, stopFields(s));
    if (score > 0)
      hits.push({
        type: "journey_stop",
        id: s.id,
        url: `/prophets/${s.id}`,
        title: s.name,
        titleAr: s.arabicName,
        snippet: s.summary,
        facet: s.type === "milestone" ? "milestones" : "prophets",
        // A prophet outranks a surah of the same name (Ibrahim, Yusuf, Nuh).
        score: score + 0.5,
      });
    // A surah that tells the story is a result of its own, pointing to the Quran explorer.
    for (const su of s.surahs ?? []) {
      const ss = scoreFields(q, [{ text: su.name, title: true }, { text: su.arabic, title: true }, { text: String(su.number) }]);
      if (ss > 0) hits.push({ type: "surah", id: `${su.number}`, url: `/quran/${su.number}`, title: `Surah ${su.name}`, titleAr: su.arabic, snippet: `Surah ${su.number}`, facet: "quran", score: ss });
    }
  }
  return dedupe(hits);
}

/** Highest score first; ties by title; one result per URL and id (the best one). */
export function dedupe(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const key = (h: SearchHit) => `${h.url}|${h.id}`;
  return [...hits]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .filter((h) => (seen.has(key(h)) ? false : (seen.add(key(h)), true)));
}
