import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { describe, expect, test } from "vitest";
import { quranStructure, surahList } from "@/content/quran";
import { ayahPositions, divisionRange } from "@/lib/quran-division-range";

const structure = quranStructure();
const counts = surahList()?.map((s) => s.ayahs) ?? null;
const ready = !!structure && !!counts;

describe.skipIf(!ready)("mushaf page and juz ranges", () => {
  test("pages tile the whole Quran with no gap and no overlap (6,236 ayat)", () => {
    let total = 0;
    let prevEnd: [number, number] | null = null;
    for (let n = 1; n <= 604; n++) {
      const r = divisionRange(structure!.pages, n, counts!)!;
      const list = ayahPositions(r.from, r.to, counts!);
      expect(list.length).toBeGreaterThan(0);
      if (prevEnd) expect(list[0]).not.toEqual(prevEnd);
      total += list.length;
      prevEnd = r.to;
    }
    expect(total).toBe(6236);
    expect(prevEnd).toEqual([114, 6]);
  });
  test("30 juz tile the whole Quran; juz 1 starts at 1:1 and juz 30 ends at 114:6", () => {
    let total = 0;
    for (let n = 1; n <= 30; n++) total += ayahPositions(...(Object.values(divisionRange(structure!.juz, n, counts!)!) as [[number, number], [number, number]]), counts!).length;
    expect(total).toBe(6236);
    expect(divisionRange(structure!.juz, 1, counts!)!.from).toEqual([1, 1]);
    expect(divisionRange(structure!.juz, 30, counts!)!.to).toEqual([114, 6]);
  });
  test("out-of-range and non-integer numbers have no range", () => {
    for (const n of [0, 605, 1.5, NaN, -1]) expect(divisionRange(structure!.pages, n, counts!)).toBeNull();
    expect(divisionRange(structure!.juz, 31, counts!)).toBeNull();
  });
});
