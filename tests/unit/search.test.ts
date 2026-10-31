// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
// No database in unit tests: the engine must still search everything that ships with the site.
vi.mock("@/lib/supabase/server", () => ({ getPublicSupabase: () => null, getServerSupabase: async () => null }));

import {
  aliasExpansions,
  editDistance,
  nameKey,
  normalize,
  normalizeArabic,
  parseReference,
  plainSnippet,
  scoreFields,
  searchJourney,
  termScore,
  tokens,
} from "@/lib/search";
import { quranIndexSize, searchQuran, searchStatic, searchSurahs } from "@/lib/search-sources";
import { PER_PAGE, unifiedSearch } from "@/lib/search-engine";
import { ayahArabic } from "@/content/quran";

describe("normalisation", () => {
  test("Arabic: tashkeel, Quranic marks, tatweel and letter forms fold", () => {
    expect(normalizeArabic("إِبْرَاهِيمُ")).toBe("ابراهيم");
    expect(normalizeArabic("ٱلرَّحْمَٰنِ")).toBe("الرحمن");
    expect(normalizeArabic("مَدْرَسَةٌ")).toBe("مدرسه");
    expect(normalizeArabic("مُوسَىٰ")).toBe("موسي");
    expect(normalizeArabic("سُـــورة")).toBe("سوره");
    expect(normalizeArabic("مُؤْمِن")).toBe("مومن");
    expect(normalizeArabic("دَاوُۥدَ")).toBe("داود");
  });
  test("Urdu letter forms fold to the Arabic ones", () => {
    expect(normalizeArabic("یوسف")).toBe(normalizeArabic("يُوسُف"));
    expect(normalizeArabic("موسیٰ")).toBe(normalizeArabic("مُوسَىٰ"));
    expect(normalizeArabic("کتاب")).toBe(normalizeArabic("كِتَاب"));
    expect(normalizeArabic("مکہ")).toBe(normalizeArabic("مكة"));
  });
  test("Eastern digits become ASCII, so Arabic references parse", () => {
    expect(normalizeArabic("١٢:٤")).toBe("12:4");
    expect(normalizeArabic("۲:۲۵۵")).toBe("2:255");
  });
  test("Latin: marks and apostrophes fold; hyphenated names give parts and the joined form", () => {
    expect(normalize("Ṣāliḥ")).toBe("salih");
    expect(normalize("Shu'ayb")).toBe("shuayb");
    expect(tokens("Al-Baqara")).toEqual(expect.arrayContaining(["albaqara", "al", "baqara"]));
  });
  test("spelling keys join common transliterations", () => {
    expect(nameKey("yousuf")).toBe(nameKey("yusuf"));
    expect(nameKey("baqarah")).toBe(nameKey("baqara"));
    expect(nameKey("ismaeel")).toBe(nameKey("ismail"));
    expect(nameKey("faatiha")).toBe(nameKey("fatiha"));
  });
});

describe("matching", () => {
  test("edit distance with transpositions, bounded", () => {
    expect(editDistance("ibrahim", "ibrahim")).toBe(0);
    expect(editDistance("ibrahim", "ibrahin")).toBe(1);
    expect(editDistance("musa", "msua")).toBe(1); // transposition
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("a", "abcdef", 2)).toBe(3);
  });
  test("typo tolerance only on title-like fields and only from 4 letters", () => {
    expect(termScore("ibrahm", ["ibrahim"], true)).toBeGreaterThan(0);
    expect(termScore("ibrahm", ["ibrahim"], false)).toBe(0);
    expect(termScore("nuh", ["nur"], true)).toBe(0); // under 4 letters: no typo allowance
    expect(termScore("yousef", ["yusuf"], true)).toBeGreaterThan(0);
  });
  test("every term must match; a title equal to the query scores highest", () => {
    expect(scoreFields("yusuf dream", [{ text: "Yusuf", title: true }])).toBe(0);
    const exact = scoreFields("yusuf", [{ text: "Yusuf", title: true }]);
    const partial = scoreFields("yusuf", [{ text: "Yusuf and his brothers", title: true }]);
    expect(exact).toBeGreaterThan(partial);
  });
  test("aliases expand to the canonical name and back, without inventing new ones", () => {
    expect(aliasExpansions("Joseph")).toContain("yusuf");
    expect(aliasExpansions("Moses")).toContain("musa");
    expect(aliasExpansions("ibrahim")).toContain("abraham");
    expect(aliasExpansions("dream")).toEqual([]);
  });
  test("references", () => {
    expect(parseReference("12:4")).toEqual({ surah: 12, from: 4, to: 4 });
    expect(parseReference("Q 2:255")).toEqual({ surah: 2, from: 255, to: 255 });
    expect(parseReference("2:30-32")).toEqual({ surah: 2, from: 30, to: 32 });
    expect(parseReference("١٢:٤")).toEqual({ surah: 12, from: 4, to: 4 });
    for (const bad of ["115:1", "0:3", "12:0", "12:9-3", "Yusuf"]) expect(parseReference(bad), bad).toBeNull();
  });
  test("snippets drop markdown and never exceed the limit", () => {
    expect(plainSnippet("**Bold** [link](https://x.test) _it_")).toBe("Bold link it");
    expect(plainSnippet("a ".repeat(300)).length).toBeLessThanOrEqual(220);
  });
});

describe("journey and names", () => {
  test("English, transliterated, typo and Arabic forms find the same prophet", () => {
    for (const q of ["Joseph", "Yusuf", "Yousuf", "Yousef", "Yusef", "يُوسُف", "يوسف", "یوسف"]) expect(searchJourney(q)[0]?.id, q).toBe("yusuf");
    for (const q of ["Moses", "Musa", "Moosa", "موسى", "موسیٰ"]) expect(searchJourney(q)[0]?.id, q).toBe("musa");
    for (const q of ["Abraham", "Ibrahim", "Ebrahim", "Ibraheem", "Ibrahm", "إبراهيم", "ابراہیم"]) expect(searchJourney(q)[0]?.id, q).toBe("ibrahim");
    expect(searchJourney("Shuaib")[0]?.id).toBe("shuayb");
  });
  test("no result for nonsense or one letter", () => {
    expect(searchJourney("zzqqxx")).toEqual([]);
    expect(searchJourney("a")).toEqual([]);
  });
});

describe("Quran text (Tanzil Uthmani, verbatim)", () => {
  test("the whole imported text is indexed", () => {
    expect(quranIndexSize()).toBe(6236);
  });
  test("plain Arabic without vowel marks finds the ayah, and the hit carries the verbatim text", () => {
    const hits = searchQuran("الرحمن الرحيم");
    const fatiha = hits.find((h) => h.id === "1:3");
    expect(fatiha).toBeDefined();
    expect(fatiha!.arabic).toBe(ayahArabic(1, 3));
    expect(fatiha!.url).toBe("/quran/1#ayah-3");
    expect(fatiha!.facet).toBe("ayahs");
  });
  test("Uthmani spelling differences still match (dagger alef, alef wasla)", () => {
    expect(searchQuran("ذلك الكتاب لا ريب فيه").some((h) => h.id === "2:2")).toBe(true);
    expect(searchQuran("قل هو الله احد").some((h) => h.id === "112:1")).toBe(true);
  });
  test("Urdu-script input finds the Arabic ayah", () => {
    expect(searchQuran("یوسف").some((h) => h.id.startsWith("12:"))).toBe(true);
  });
  test("references return those ayat first; Latin queries do not search the Arabic text", () => {
    expect(searchQuran("2:255").map((h) => h.id)).toEqual(["2:255"]);
    expect(searchQuran("12:4-6").map((h) => h.id)).toEqual(["12:4", "12:5", "12:6"]);
    expect(searchQuran("mercy")).toEqual([]);
  });
  test("surah names: transliterated with typos, English and Arabic", () => {
    expect(searchSurahs("Al-Baqarah")[0]?.url).toBe("/quran/2");
    expect(searchSurahs("baqara")[0]?.url).toBe("/quran/2");
    expect(searchSurahs("Fatiha")[0]?.url).toBe("/quran/1");
    expect(searchSurahs("The Cow")[0]?.url).toBe("/quran/2");
    expect(searchSurahs("الكهف")[0]?.url).toBe("/quran/18");
    expect(searchSurahs("Kahf")[0]?.url).toBe("/quran/18");
  });
});

describe("static pages", () => {
  test("module pages are found in English, Arabic and Urdu", () => {
    expect(searchStatic("creation atlas", "en").some((h) => h.url === "/creation")).toBe(true);
    expect(searchStatic("guidance", "en").some((h) => h.url === "/guidance")).toBe(true);
    expect(searchStatic("qiraat", "en").some((h) => h.url === "/qiraat")).toBe(true);
    expect(searchStatic("القراءات", "ar").some((h) => h.url === "/qiraat")).toBe(true);
    expect(searchStatic("قراءات", "ur").some((h) => h.url === "/qiraat")).toBe(true);
    expect(searchStatic("methodology", "en").some((h) => h.url === "/methodology")).toBe(true);
  });
});

describe("unified search (no database)", () => {
  test("ranks the prophet first, counts facets and reports the database state", async () => {
    const r = await unifiedSearch({ q: "Ibrahim" });
    expect(r.results[0]?.id).toBe("ibrahim");
    expect(r.facets.prophets).toBeGreaterThan(0);
    expect(r.facets.quran).toBeGreaterThan(0); // Surah Ibrahim
    expect(r.database).toBe("not_configured");
  });
  test("facet filter and pagination", async () => {
    const all = await unifiedSearch({ q: "الله" });
    expect(all.facets.ayahs).toBeGreaterThan(PER_PAGE);
    const ayat = await unifiedSearch({ q: "الله", facet: "ayahs", page: 2 });
    expect(ayat.results).toHaveLength(PER_PAGE);
    expect(ayat.results.every((h) => h.facet === "ayahs")).toBe(true);
    expect(ayat.page).toBe(2);
    expect(ayat.pages).toBe(Math.ceil(all.facets.ayahs! / PER_PAGE));
    const page1 = await unifiedSearch({ q: "الله", facet: "ayahs", page: 1 });
    expect(new Set([...page1.results, ...ayat.results].map((h) => h.id)).size).toBe(PER_PAGE * 2);
  });
  test("an unknown facet is ignored, an out-of-range page clamps, an empty query returns nothing", async () => {
    expect((await unifiedSearch({ q: "Musa", facet: "nope" })).facet).toBeNull();
    const r = await unifiedSearch({ q: "Musa", page: 999 });
    expect(r.page).toBe(r.pages);
    expect((await unifiedSearch({ q: "   " })).total).toBe(0);
  });
  test("results are source text only: every hit has a URL on this site", async () => {
    for (const q of ["Moses", "موسى", "Yusuf", "12:4", "creation"]) {
      const r = await unifiedSearch({ q });
      for (const h of r.results) expect(h.url.startsWith("/"), `${q} ${h.url}`).toBe(true);
    }
  });
});
