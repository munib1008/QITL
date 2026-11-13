import type { AyahPos } from "@/lib/quran-reader";

export type DivisionKind = "page" | "juz";
export const DIVISION_COUNT: Record<DivisionKind, number> = { page: 604, juz: 30 };

/** The ayah before a position (null before 1:1). `counts[i]` is the ayah count of surah i + 1. */
export function prevPos([s, a]: AyahPos, counts: number[]): AyahPos | null {
  if (a > 1) return [s, a - 1];
  if (s > 1) return [s - 1, counts[s - 2]!];
  return null;
}

/**
 * The first and last ayah of mushaf page n (1-604) or juz n (1-30), from the imported boundaries (Tanzil quran-data, CC BY 3.0):
 * a division runs from its start to the ayah before the next division's start; the last one ends at the end of surah 114.
 * Null when n is not a whole number in range.
 */
export function divisionRange(starts: AyahPos[], n: number, counts: number[]): { from: AyahPos; to: AyahPos } | null {
  if (!Number.isInteger(n) || n < 1 || n > starts.length) return null;
  const from = starts[n - 1]!;
  const to = n < starts.length ? prevPos(starts[n]!, counts) : ([114, counts[113]!] as AyahPos);
  return to ? { from, to } : null;
}

/** Every ayah position from `from` to `to`, in Quran order. */
export function ayahPositions(from: AyahPos, to: AyahPos, counts: number[]): AyahPos[] {
  const out: AyahPos[] = [];
  let [s, a] = from;
  while (s < to[0] || (s === to[0] && a <= to[1])) {
    out.push([s, a]);
    a += 1;
    if (a > counts[s - 1]!) {
      s += 1;
      a = 1;
    }
    if (s > 114) break;
  }
  return out;
}
