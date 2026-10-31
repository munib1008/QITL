import "server-only";
import { ayahArabic, quranSource, surahList } from "@/content/quran";
import { INFO_PAGES } from "@/content/pages";
import { COLLECTIONS } from "@/lib/data/hadith";
import { CATEGORIES } from "@/lib/data/creation-types";
import { searchStrings } from "@/lib/i18n/modules/search";
import { ayahHash } from "@/lib/refs";
import { hasArabicScript, normalizeArabic, parseReference, scoreFields, type Field, type SearchHit } from "@/lib/search";

/*
 * Sources that ship with the site: the imported Quran text (Tanzil Uthmani, verbatim), surah names and static pages.
 * The Quran index is built once, on the first search, from the checksum-verified text; it holds normalised copies for
 * matching only. Results always show the verbatim ayah from ayahArabic(), never the normalised copy.
 */

interface AyahEntry {
  surah: number;
  ayah: number;
  /** Normalised, with spaces around for whole-word checks. */
  norm: string;
  /** Normalised and without alef or hamza: Uthmani spelling (ٱلْكِتَٰبُ) still finds the plain spelling (الكتاب). */
  skeleton: string;
}

let quranIndex: AyahEntry[] | null | undefined;

const skeleton = (s: string) => s.replace(/[\u0627\u0621]/g, "");
const squash = (s: string) => ` ${normalizeArabic(s).replace(/[^\u0621-\u064A\s]/g, "").replace(/\s+/g, " ").trim()} `;

function buildQuranIndex(): AyahEntry[] | null {
  if (quranIndex !== undefined) return quranIndex;
  const surahs = surahList();
  if (!surahs) return (quranIndex = null);
  const out: AyahEntry[] = [];
  for (const s of surahs)
    for (let a = 1; a <= s.ayahs; a++) {
      const text = ayahArabic(s.number, a);
      if (!text) continue;
      const norm = squash(text);
      out.push({ surah: s.number, ayah: a, norm, skeleton: skeleton(norm) });
    }
  return (quranIndex = out);
}

/** Exposed for tests: the number of ayat indexed (6236 when the import is present). */
export function quranIndexSize(): number {
  return buildQuranIndex()?.length ?? 0;
}

function ayahHit(surah: number, ayah: number, score: number, surahName?: string): SearchHit | null {
  const text = ayahArabic(surah, ayah);
  if (!text) return null;
  return {
    type: "ayah",
    id: `${surah}:${ayah}`,
    url: `/quran/${surah}${ayahHash(ayah)}`,
    title: `Q ${surah}:${ayah}${surahName ? ` · ${surahName}` : ""}`,
    snippet: "",
    arabic: text,
    facet: "ayahs",
    score,
  };
}

/**
 * Ayat whose words contain the Arabic query, with or without vowel marks: whole-word phrase matches rank above
 * partial words, and those above matches that only agree once alef and hamza are ignored. A reference query
 * ("2:255", "12:4-6") returns those ayat first.
 */
export function searchQuran(q: string): SearchHit[] {
  const index = buildQuranIndex();
  if (!index) return [];
  const names = new Map((surahList() ?? []).map((s) => [s.number, s.name]));
  const hits: SearchHit[] = [];
  const ref = parseReference(q);
  if (ref) {
    for (let a = ref.from; a <= ref.to; a++) {
      const h = ayahHit(ref.surah, a, 100 - (a - ref.from) * 0.01, names.get(ref.surah));
      if (h) hits.push(h);
    }
    return hits;
  }
  if (!hasArabicScript(q)) return [];
  const nq = squash(q).trim();
  if (nq.replace(/\s/g, "").length < 2) return [];
  const sq = skeleton(nq);
  const words = nq.split(" ").length;
  for (const e of index) {
    let score = 0;
    if (e.norm.includes(` ${nq} `)) score = 2.6;
    else if (e.norm.includes(nq)) score = 1.9;
    else if (sq.length >= 2 && e.skeleton.includes(sq)) score = 1.4;
    if (!score) continue;
    // Longer phrases are more specific; earlier ayat break ties so results read in mushaf order.
    const h = ayahHit(e.surah, e.ayah, score + Math.min(words - 1, 4) * 0.3);
    if (h) hits.push(h);
  }
  return hits;
}

/** Surah names: transliterated, English meaning and Arabic, typo tolerant. */
export function searchSurahs(q: string): SearchHit[] {
  const list = surahList();
  if (!list) return [];
  const asNumber = /^\d{1,3}$/.test(q.trim()) ? Number(q.trim()) : null;
  const hits: SearchHit[] = [];
  for (const s of list) {
    const fields: Field[] = [
      { text: s.name, title: true },
      { text: s.arabic, title: true },
      { text: `${s.name.replace(/^(al|an|ash|as|at|ad|adh|az|ar|aal|ath)-/i, "")}`, title: true },
      { text: s.english ?? "" },
      { text: `surah sura ${s.number} سورة ${s.revelation ?? ""}` },
    ];
    let score = scoreFields(q, fields);
    if (asNumber === s.number) score = Math.max(score, 3);
    if (score > 0)
      hits.push({
        type: "surah",
        id: String(s.number),
        url: `/quran/${s.number}`,
        title: `Surah ${s.name}`,
        titleAr: s.arabic,
        snippet: `${s.english ? `${s.english} · ` : ""}Surah ${s.number} · ${s.ayahs} ayat${s.revelation ? ` · ${s.revelation}` : ""}`,
        facet: "quran",
        score,
      });
  }
  return hits;
}

interface StaticPage {
  url: string;
  facet: SearchHit["facet"];
  title: string;
  titleAr?: string;
  keywords: string;
  key?: keyof ReturnType<typeof searchStrings>["pages"];
  /** Distinguishes entries that share a URL (the creation categories). */
  id?: string;
}

let staticPages: StaticPage[] | undefined;

function pages(): StaticPage[] {
  if (staticPages) return staticPages;
  const en = searchStrings("en").pages;
  const ar = searchStrings("ar").pages;
  const ur = searchStrings("ur").pages;
  const mod = (url: string, key: keyof typeof en, keywords: string, facet: SearchHit["facet"] = "pages"): StaticPage => ({
    url,
    facet,
    key,
    title: en[key],
    titleAr: ar[key] !== en[key] ? ar[key] : undefined,
    keywords: `${keywords} ${ur[key] !== en[key] ? ur[key] : ""}`,
  });
  staticPages = [
    mod("/prophets", "prophets", "prophets journey chapters anbiya"),
    mod("/timeline", "timeline", "timeline chronology order history"),
    mod("/atlas", "atlas", "atlas map places geography"),
    mod("/quran", "quran", "quran surahs mushaf reader"),
    mod("/hadith", "hadith", "hadith collections narrations sunnah"),
    mod("/events", "events", "events encyclopedia"),
    mod("/stories", "stories", "stories qisas"),
    mod("/genealogy", "genealogy", "genealogy family tree lineage nasab"),
    mod("/last-hour", "lastHour", "last hour signs qiyamah day of judgement", "last_hour"),
    mod("/community", "community", "community discussion forum"),
    mod("/community/questions", "questions", "questions answers mufti fatwa ask", "questions"),
    mod("/creation", "creation", "creation atlas angels jinn humans animals heavens earth", "creation"),
    mod("/guidance", "guidance", "life guidance topics lessons", "guidance"),
    mod("/life-through-ages", "lifestyle", "life through the ages how they lived daily life history", "lifestyle"),
    mod("/life-through-ages/food", "lifestyleFood", "food diet meals", "lifestyle"),
    mod("/life-through-ages/day", "lifestyleDay", "day reconstruction daily life", "lifestyle"),
    mod("/life-through-ages/longevity", "lifestyleLongevity", "longevity lifespan age research", "lifestyle"),
    mod("/life-through-ages/compare", "lifestyleCompare", "compare then now", "lifestyle"),
    mod("/qiraat", "qiraat", "qiraat qira'at recitations readers riwayat hafs warsh ahruf", "qiraat"),
    mod("/qiraat/compare", "qiraatCompare", "compare recitations qiraat riwayat", "qiraat"),
    mod("/learn", "learn", "learn arabic quranic lessons"),
    ...COLLECTIONS.map((c) => ({ url: `/hadith/${c.id}`, facet: "hadith" as const, title: c.name, titleAr: c.arabic, keywords: `${c.compiler} hadith collection` })),
    ...CATEGORIES.map((c) => ({ url: `/creation#cr-categories`, id: c.id, facet: "creation" as const, title: c.nameEn, titleAr: c.nameAr, keywords: `creation atlas ${c.id.replace(/_/g, " ")}` })),
    ...Object.entries(INFO_PAGES).map(([slug, p]) => ({ url: slug === "guidelines" ? "/community/guidelines" : `/${slug}`, facet: "pages" as const, title: p.title, keywords: p.lead })),
  ];
  return staticPages;
}

/** Static pages and sections, in the visitor's language where a title exists. */
export function searchStatic(q: string, locale: string): SearchHit[] {
  const local = searchStrings(locale).pages;
  const hits: SearchHit[] = [];
  for (const p of pages()) {
    const score = scoreFields(q, [{ text: p.title, title: true }, { text: p.titleAr ?? "", title: true }, { text: p.keywords }]);
    if (score <= 0) continue;
    const title = p.key && locale !== "en" ? local[p.key] : p.title;
    hits.push({ type: "page", id: p.id ?? p.url, url: p.url, title, titleAr: p.titleAr && p.titleAr !== title ? p.titleAr : undefined, snippet: p.key ? "" : p.keywords.slice(0, 220), facet: p.facet, score: score * 0.8 });
  }
  return hits;
}

export { quranSource };
