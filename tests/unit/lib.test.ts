import { describe, expect, test } from "vitest";
import { normalize, normalizeArabic, normalizeLatin, searchJourney } from "@/lib/search";
import { formatAyah, parseAyahRange, quranHref } from "@/lib/refs";
import { CommentInput, decodeIntent, encodeIntent, safeReturnTo } from "@/lib/validation";
import { pickActive, HYSTERESIS_PX } from "@/components/journey/JourneyTimeline";
import { safeHref } from "@/components/ui/Markdown";

describe("references", () => {
  test("parses ayah ranges with an en dash or hyphen", () => {
    expect(parseAyahRange("2:30–39")).toEqual({ surah: 2, from: 30, to: 39 });
    expect(parseAyahRange("Q 12:4")).toEqual({ surah: 12, from: 4, to: 4 });
    expect(parseAyahRange("12:4-6")).toEqual({ surah: 12, from: 4, to: 6 });
  });
  test("rejects impossible references instead of guessing", () => {
    for (const bad of ["115:1", "0:1", "12:0", "12:9–3", "twelve:four", ""]) expect(parseAyahRange(bad), bad).toBeNull();
  });
  test("links and formats", () => {
    expect(quranHref("2:30–39")).toBe("/quran/2#ayah-30");
    expect(formatAyah({ surah: 2, from: 30, to: 39 })).toBe("Q 2:30–39");
  });
});

describe("search", () => {
  test("Arabic normalisation strips vowel marks and folds letter forms", () => {
    expect(normalizeArabic("إِبْرَاهِيمُ")).toBe("ابراهيم");
    expect(normalizeArabic("مُوسَىٰ")).toBe(normalizeArabic("موسي"));
  });
  test("Latin normalisation folds transliteration marks", () => {
    expect(normalizeLatin("Shu'ayb")).toBe("shuayb");
    expect(normalizeLatin("Ṣāliḥ")).toBe("salih");
    expect(normalize("  Yūsuf ")).toBe("yusuf");
  });
  test("finds prophets by English, transliteration and Arabic", () => {
    expect(searchJourney("Joseph")[0]?.id).toBe("yusuf");
    expect(searchJourney("yousuf")[0]?.id).toBe("yusuf");
    expect(searchJourney("يُوسُف")[0]?.id).toBe("yusuf");
    expect(searchJourney("Shuaib")[0]?.id).toBe("shuayb");
  });
  test("finds surahs and gives no result for nonsense", () => {
    expect(searchJourney("Al-Baqarah").some((h) => h.url === "/quran/2")).toBe(true);
    expect(searchJourney("zzqqxx")).toEqual([]);
    expect(searchJourney("a")).toEqual([]);
  });
});

describe("validation", () => {
  test("returnTo stays on this site", () => {
    expect(safeReturnTo("/prophets/yusuf?x=1#story")).toBe("/prophets/yusuf?x=1#story");
    for (const bad of ["https://evil.example/", "//evil.example", "/\\evil.example", "javascript:alert(1)", null, ""]) expect(safeReturnTo(bad)).toBe("/");
  });
  test("intents round-trip and reject junk", () => {
    const i = { action: "bookmark" as const, target: { type: "quran_verse" as const, id: "12:4" } };
    expect(decodeIntent(encodeIntent(i))).toEqual(i);
    expect(decodeIntent("delete:everything:now")).toBeNull();
    expect(decodeIntent("bookmark:journey_stop:<script>")).toBeNull();
  });
  test("comment citations must be a real reference format", () => {
    expect(CommentInput.safeParse({ body: "ok here", citation: "Q 12:3" }).success).toBe(true);
    expect(CommentInput.safeParse({ body: "ok here", citation: "Bukhari 1" }).success).toBe(true);
    expect(CommentInput.safeParse({ body: "ok here", citation: "trust me" }).success).toBe(false);
  });
});

describe("journey scroll-sync", () => {
  test("a nearby stop takes over only when it is at least 48px closer", () => {
    expect(pickActive([{ id: "a", d: 100 }, { id: "b", d: 100 - HYSTERESIS_PX + 1 }], "a")).toBe("a");
    expect(pickActive([{ id: "a", d: 100 }, { id: "b", d: 100 - HYSTERESIS_PX - 1 }], "a")).toBe("b");
    expect(pickActive([{ id: "b", d: 10 }], "gone")).toBe("b");
  });
});

describe("markdown links", () => {
  test("only same-site paths and https are allowed", () => {
    expect(safeHref("/quran/2")).toBe("/quran/2");
    expect(safeHref("https://tanzil.net/")).toBe("https://tanzil.net/");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("http://insecure.example")).toBeNull();
  });
});
