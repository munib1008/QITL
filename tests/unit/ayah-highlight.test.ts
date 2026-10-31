import { describe, expect, test } from "vitest";
import { parseAyahHash } from "@/components/quran/useAyahHighlight";
import { ayahHash, quranHref } from "@/lib/refs";

describe("Quran reference targets", () => {
  test("a single ayah links to #ayah-N, a range to #ayah-N-M", () => {
    expect(quranHref("12:4")).toBe("/quran/12#ayah-4");
    expect(quranHref("2:30–39")).toBe("/quran/2#ayah-30-39");
    expect(ayahHash(5, 5)).toBe("#ayah-5");
    expect(ayahHash(5, null)).toBe("#ayah-5");
  });
  test("the reader reads both forms and ignores anything else", () => {
    expect(parseAyahHash("#ayah-4")).toEqual({ from: 4, to: 4 });
    expect(parseAyahHash("#ayah-30-39")).toEqual({ from: 30, to: 39 });
    expect(parseAyahHash("#ayah-9-3")).toBeNull();
    expect(parseAyahHash("#tafsir-h")).toBeNull();
  });
});
