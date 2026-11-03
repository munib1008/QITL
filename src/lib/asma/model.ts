import { tokenizeVerse } from "./corpus";
import { hasArabicLetter, normalizeArabic } from "./normalize";

/** Shapes returned by the public_asma_* database functions, and the pure helpers the pages use. No Quran, hadith or dua text lives here. */
export type Measure = "A" | "B" | "C";
export type Lang = "en" | "ar" | "ur";
export type Recognition = "educational_list" | "disputed_candidate" | "under_research";
export type ScholarlyStatus = "not_reviewed" | "under_review" | "changes_requested" | "approved" | "rejected" | "invalidated";
export type Referent = "unreviewed" | "confirmed_allah" | "refers_to_other" | "disputed";

export interface MeasureSummary {
  count: number;
  verses: number;
  queryHash: string;
  stale: boolean;
}
export interface CountSummary {
  methodology: string;
  normalisation: string;
  tokenisation: string;
  queryVersion: string;
  edition: { source: string; version: string; sha256: string; contentSha256: string };
  measures: Partial<Record<Measure, MeasureSummary>>;
}

export interface NameListItem {
  slug: string;
  ar: string;
  vowelled: string;
  transliteration: string;
  rendering: { en: string | null; ar: string | null; ur: string | null };
  root: string | null;
  recognition_status: Recognition;
  recognition_basis: string;
  scholarly_status: ScholarlyStatus;
  ai_generated: boolean;
  published: boolean;
  needs_rereview: boolean;
  updated_at: string;
  summary: CountSummary | null;
}

export interface NameDoc extends NameListItem {
  ai_model: string | null;
  version: number;
  classification_version: number;
  last_research_review: string | null;
  surface_forms: string[];
  aliases: Array<{ alias: string; language: Lang; kind: string }>;
  translations: Array<{ language: Lang; kind: string; body: string; origin: string; evidence_status: string; reviewed: boolean }>;
  linguistics: Array<{ aspect: string; language: Lang; body: string; evidence_status: string; reviewed: boolean }>;
  hadith_evidence: Array<{ purpose: string; evidence_status: "sourced" | "needs_source"; reference_label: string | null; collection: string | null; number: string | null; grading: { grader: string; grade: string } | null; reviewed: boolean }>;
  tafsir_links: Array<{ evidence_status: string; locator: string | null; surah: number | null; ayah: number | null; work: string | null }>;
  positions: Array<{ topic: string; evidence_status: string; scholar: string | null; work: string | null; locator: string | null; summary: string | null; reviewed: boolean }>;
  relationships: Array<{ kind: string; other: string; other_ar: string; other_transliteration: string; surah: number | null; ayah: number | null; evidence_status: string; note: string | null }>;
  misconceptions: Array<{ slug: string; claim: string; correction: string | null; evidence_status: string; reviewed: boolean }>;
  duas: Array<{ slug: string; category: "A" | "B"; title_en: string | null; title_ar: string | null; title_ur: string | null }>;
  topics: Array<{ slug: string; title_en: string | null; title_ar: string | null; title_ur: string | null; surah: number | null; ayah: number | null; basis: string | null; evidence_status: string }>;
}

export interface OccurrenceRowDoc {
  surah: number;
  ayah: number;
  token: number;
  form: string;
  raw: string;
  root: string | null;
  relation: "direct" | "related";
  referent_status: Referent;
  text: string;
}
export interface OccurrencePage {
  measure: Measure;
  total: number;
  rows: OccurrenceRowDoc[];
}

export interface DuaListItem {
  slug: string;
  category: "A" | "B";
  title_en: string | null;
  title_ar: string | null;
  title_ur: string | null;
  evidence_status: "sourced" | "needs_source";
  scholarly_status: ScholarlyStatus;
  published: boolean;
}
export interface DuaDoc extends DuaListItem {
  updated_at: string;
  source: { kind: "quran"; surah: number; from: number; to: number } | { kind: "hadith"; collection: string | null; number: string | null; grading: { grader: string; grade: string } | null } | { kind: "none"; reference_label: string | null };
  personal_wording: string | null;
  wording_label: string | null;
  names: Array<{ slug: string; ar: string; transliteration: string; note: string | null }>;
}
export interface TopicDoc {
  slug: string;
  title_en: string | null;
  title_ar: string | null;
  title_ur: string | null;
  scholarly_status: ScholarlyStatus;
  names: Array<{ slug: string; ar: string; transliteration: string; surah: number | null; ayah: number | null; basis: string | null; evidence_status: string }>;
}

export const pick = (o: { en: string | null; ar: string | null; ur: string | null }, locale: string): string | null => (locale === "ar" ? o.ar ?? o.en : locale === "ur" ? o.ur ?? o.en : o.en);
export const titleOf = (t: { title_en: string | null; title_ar: string | null; title_ur: string | null }, locale: string): string =>
  (locale === "ar" ? t.title_ar : locale === "ur" ? t.title_ur : t.title_en) ?? t.title_en ?? t.title_ar ?? t.title_ur ?? "";

/** "2:255", "Q 2:255", "2.255", "٢:٢٥٥" -> [2, 255]; anything else null. */
export function parseVerseQuery(input: string): { surah: number; ayah: number } | null {
  const v = input.trim().replace(/^Q\s*/i, "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
  const m = /^(\d{1,3})\s*[:.\s/]\s*(\d{1,3})$/.exec(v);
  if (!m) return null;
  const surah = Number(m[1]);
  const ayah = Number(m[2]);
  return surah >= 1 && surah <= 114 && ayah >= 1 && ayah <= 286 ? { surah, ayah } : null;
}

const latin = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ'’`ʿʾ-]/g, " ").replace(/\s+/g, " ").trim();

/** Does the search text match a Name? Arabic is compared without marks; Latin text without accents, hyphens and apostrophes. */
export function matchesName(n: NameListItem, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (/[؀-ۿ]/.test(q)) {
    const nq = normalizeArabic(q).replace(/^ال/, "");
    return (
      normalizeArabic(n.ar).replace(/^ال/, "").includes(nq) ||
      [n.rendering.ar, n.root].some((x) => x && normalizeArabic(x).includes(normalizeArabic(q))) ||
      [n.rendering.ur].some((x) => x && x.includes(q))
    );
  }
  const lq = latin(q);
  if (!lq) return false;
  return [n.transliteration, n.rendering.en, n.slug].some((x) => x && latin(x).includes(lq));
}

export type SortKey = "order" | "alpha" | "exact";
export type FilterKey = "all" | "withExact" | "noExact";

export const exactCount = (n: NameListItem): number => n.summary?.measures.A?.count ?? 0;

export function sortAndFilter(names: NameListItem[], opts: { query: string; sort: SortKey; filter: FilterKey; verseSlugs?: Set<string> | null }): NameListItem[] {
  let out = names.filter((n) => (opts.verseSlugs ? opts.verseSlugs.has(n.slug) : matchesName(n, opts.query)));
  if (opts.filter === "withExact") out = out.filter((n) => exactCount(n) > 0);
  if (opts.filter === "noExact") out = out.filter((n) => exactCount(n) === 0);
  if (opts.sort === "alpha") out = [...out].sort((a, b) => latin(a.transliteration).localeCompare(latin(b.transliteration)));
  if (opts.sort === "exact") out = [...out].sort((a, b) => exactCount(b) - exactCount(a) || a.slug.localeCompare(b.slug));
  return out;
}

/** Where the Quran reader shows an ayah. */
export const quranHref = (surah: number, ayah: number) => `/quran/${surah}#ayah-${ayah}`;

export interface HighlightPart {
  text: string;
  hit: boolean;
}
/** Splits a verse into words, marking the word at `tokenIndex` (the engine's index: words only, basmala prefix excluded). */
export function highlightWord(surah: number, ayah: number, verse: string, tokenIndex: number): HighlightPart[] {
  const prefix = tokenizeVerse({ surah, ayah, text: verse }).filter((t) => t.basmalaPrefix).length;
  let w = 0;
  return verse.split(/([\s\u00A0\u200B]+)/).map((text) => {
    if (!text || /^[\s\u00A0\u200B]+$/.test(text) || !hasArabicLetter(normalizeArabic(text))) return { text, hit: false };
    w += 1;
    return { text, hit: w === tokenIndex + prefix };
  });
}
