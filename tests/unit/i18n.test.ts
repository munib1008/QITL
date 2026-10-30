import { describe, expect, test } from "vitest";
import { dict } from "@/lib/i18n/dict";
import { dirOf, draftNotice, getDict, isLocale, localeFromPath, localizedPath, LOCALES, moduleStrings, resolveLocale, stripLocale } from "@/lib/i18n";
import { defaultPrefs, parsePrefs, pickAvailable, serializePrefs } from "@/lib/i18n/prefs";
import { readerStrings } from "@/lib/i18n/modules/reader";

/** Every leaf of a strings object as [dotted key, value]. */
function leaves(o: unknown, prefix = ""): Array<[string, unknown]> {
  if (typeof o !== "object" || o === null) return [[prefix, o]];
  return Object.entries(o).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

describe("locale resolution", () => {
  test("three interface languages, Arabic and Urdu right-to-left", () => {
    expect(LOCALES).toEqual(["en", "ar", "ur"]);
    expect(dirOf("en")).toBe("ltr");
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("ur")).toBe("rtl");
  });
  test("unknown, empty or malformed values fall back to English", () => {
    for (const v of [undefined, null, "", "fr", "UR", "ur-PK", 42, {}]) expect(resolveLocale(v)).toBe("en");
    expect(resolveLocale("ur")).toBe("ur");
    expect(isLocale("ur")).toBe(true);
    expect(isLocale("fa")).toBe(false);
  });
  test("getDict gives the Urdu strings, rtl, and the Urdu draft notice", () => {
    const d = getDict("ur");
    expect(d.locale).toBe("ur");
    expect(d.dir).toBe("rtl");
    expect(d.t.nav.quran).toBe("قرآن");
    expect(draftNotice(d.t)).toMatch(/مسودہ/);
    expect(draftNotice(getDict("ar").t)).toMatch(/تجريبية/);
    expect(draftNotice(getDict("en").t)).toBe("");
    expect(getDict("xx").locale).toBe("en");
  });
  test("paths: strip and add the locale prefix", () => {
    expect(stripLocale("/ur/quran/1")).toBe("/quran/1");
    expect(stripLocale("/ur")).toBe("/");
    expect(stripLocale("/urdu")).toBe("/urdu");
    expect(localeFromPath("/ur/x")).toBe("ur");
    expect(localeFromPath("/en")).toBe("en");
    expect(localeFromPath("/quran")).toBeNull();
    expect(localizedPath("/ar/quran/1", "ur")).toBe("/ur/quran/1");
    expect(localizedPath("/ur/quran/1", "en")).toBe("/quran/1");
    expect(localizedPath("/", "ur")).toBe("/ur");
  });
});

describe("dictionaries", () => {
  test("Arabic and Urdu have every English key", () => {
    const en = leaves(dict.en).map(([k]) => k).sort();
    expect(leaves(dict.ar).map(([k]) => k).sort()).toEqual(en);
    expect(leaves(dict.ur).map(([k]) => k).sort()).toEqual(en);
  });
  test("no Urdu or Arabic string is empty, except the other language's draft notice", () => {
    for (const d of [dict.ar, dict.ur]) expect(leaves(d).filter(([k, v]) => !k.startsWith("draft") && v === "")).toEqual([]);
    expect(dict.ur.draftUrduUi).not.toBe("");
    expect(dict.ur.draftArabicUi).toBe("");
  });
  test("Urdu keeps the honorifics", () => {
    expect(dict.ur.exploreNotes.prophets).toContain("(عليه السلام)");
    expect(dict.ur.exploreNotes.prophets).toContain("ﷺ");
  });
});

describe("moduleStrings", () => {
  const strings = { en: { a: "A", nested: { b: "B", c: "C" } }, ar: { a: "أ" }, ur: { nested: { b: "ب" } } };
  test("falls back to English per key, at any depth", () => {
    expect(moduleStrings("en", strings)).toEqual({ a: "A", nested: { b: "B", c: "C" } });
    expect(moduleStrings("ar", strings)).toEqual({ a: "أ", nested: { b: "B", c: "C" } });
    expect(moduleStrings("ur", strings)).toEqual({ a: "A", nested: { b: "ب", c: "C" } });
    expect(moduleStrings("fr", strings)).toEqual(strings.en);
    expect(moduleStrings("ur", { en: { a: "A" } })).toEqual({ a: "A" });
  });
  test("ignores keys English does not have and values of the wrong type", () => {
    expect(moduleStrings("ur", { en: { a: "A" }, ur: { a: 1 as unknown as string, z: "x" } as never })).toEqual({ a: "A" });
  });
  test("the reader module has all three languages", () => {
    expect(readerStrings("ur").translation).toBe("ترجمہ");
    expect(readerStrings("xx").translation).toBe("Translation");
  });
});

describe("language preferences", () => {
  test("defaults follow the interface language", () => {
    expect(defaultPrefs("en")).toEqual({ ui: "en", quran: "en", narration: "en" });
    expect(defaultPrefs("ur")).toEqual({ ui: "ur", quran: "ur", narration: "ur" });
    expect(defaultPrefs("ar")).toEqual({ ui: "ar", quran: "none", narration: "ar" });
  });
  test("the three are independent and survive a round trip", () => {
    const p = { ui: "ur" as const, quran: "en" as const, narration: "ar" as const };
    expect(parsePrefs(serializePrefs(p), "ur")).toEqual(p);
  });
  test("malformed or unknown stored values fall back to the defaults", () => {
    expect(parsePrefs("{not json", "ur")).toEqual(defaultPrefs("ur"));
    expect(parsePrefs(null, "en")).toEqual(defaultPrefs("en"));
    expect(parsePrefs({ quran: "fr", narration: "ur" }, "en")).toEqual({ ui: "en", quran: "en", narration: "ur" });
  });
  test("only licensed, reviewed languages are picked; English, then nothing, as fallback", () => {
    expect(pickAvailable("ur", ["en", "ur"])).toBe("ur");
    expect(pickAvailable("ur", ["en"])).toBe("en");
    expect(pickAvailable("ur", [])).toBeNull();
    expect(pickAvailable("none", ["en", "ur"])).toBeNull();
  });
});
