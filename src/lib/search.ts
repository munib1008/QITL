import { journeyStops, type JourneyItem } from "@/content/journey";

/** Mirrors public.normalize_arabic: strip tashkeel, Quranic marks and tatweel; fold alef, ya, ta marbuta, hamza seats. */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

/** Mirrors public.normalize_latin: fold transliteration marks and apostrophes, lowercase. */
export function normalizeLatin(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ʿʾ'’‘`-]/g, "")
    .toLowerCase();
}

export const normalize = (s: string) => normalizeLatin(normalizeArabic(s)).trim();

export type Facet = "prophets" | "milestones" | "quran" | "stories" | "events" | "places" | "hadith" | "last_hour";

export interface SearchHit {
  type: string;
  id: string;
  url: string;
  title: string;
  titleAr?: string;
  snippet: string;
  facet: Facet;
  score: number;
}

/** Common alternative spellings of names, so "Abraham" finds Ibrahim. English names as used in translations. */
const ALIASES: Record<string, string[]> = {
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

function stopText(s: JourneyItem): string {
  return [s.name, s.arabicName, s.subtitle, s.summary, s.era.label, s.place?.name, ...(s.surahs ?? []).flatMap((x) => [x.name, x.arabic, ...x.passages]), ...(ALIASES[s.id] ?? [])]
    .filter(Boolean)
    .join(" ");
}

/** Search the journey content (always available; it ships with the app). */
export function searchJourney(q: string): SearchHit[] {
  const nq = normalize(q);
  if (nq.length < 2) return [];
  const terms = nq.split(/\s+/).filter(Boolean);
  const hits: SearchHit[] = [];
  for (const s of journeyStops()) {
    const name = normalize(`${s.name} ${s.arabicName} ${(ALIASES[s.id] ?? []).join(" ")}`);
    const text = normalize(stopText(s));
    if (!terms.every((t) => text.includes(t))) continue;
    const score = terms.reduce((acc, t) => acc + (name.split(/\s+/).some((w) => w === t) ? 3 : name.includes(t) ? 2 : 1), 0);
    hits.push({
      type: "journey_stop",
      id: s.id,
      url: `/prophets/${s.id}`,
      title: s.name,
      titleAr: s.arabicName,
      snippet: s.summary,
      facet: s.type === "milestone" ? "milestones" : "prophets",
      score,
    });
    // A surah that tells the story is a result of its own, pointing to the Quran explorer.
    for (const su of s.surahs ?? []) {
      const sn = normalize(`${su.name} ${su.arabic} ${su.number}`);
      if (terms.every((t) => sn.includes(t)))
        hits.push({ type: "surah", id: `${su.number}`, url: `/quran/${su.number}`, title: `Surah ${su.name}`, titleAr: su.arabic, snippet: `Surah ${su.number}`, facet: "quran", score: 2 });
    }
  }
  const seen = new Set<string>();
  return hits
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .filter((h) => (seen.has(h.url) ? false : (seen.add(h.url), true)));
}
