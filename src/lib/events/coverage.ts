/**
 * Research coverage of the Event Universe: which ayat of the narrative register are covered by an inventory item,
 * which are not, and the counts per track. Pure (no files, no database): the admin page and docs/EVENT_COVERAGE.md
 * (scripts/event-coverage-report.ts) both use it.
 */
import { formatRef, type Ref } from "./verify";

/** Contiguous ranges per surah from a set of "surah:ayah" keys, in text order. */
export function rangesOf(keys: Iterable<string>): Ref[] {
  const bySurah = new Map<number, number[]>();
  for (const k of keys) {
    const [s, a] = k.split(":").map(Number) as [number, number];
    bySurah.set(s, [...(bySurah.get(s) ?? []), a]);
  }
  const out: Ref[] = [];
  for (const s of [...bySurah.keys()].sort((x, y) => x - y)) {
    const ayat = bySurah.get(s)!.sort((x, y) => x - y);
    let from = ayat[0]!;
    let prev = from;
    for (const a of ayat.slice(1)) {
      if (a !== prev + 1) {
        out.push({ surah: s, from, to: prev });
        from = a;
      }
      prev = a;
    }
    out.push({ surah: s, from, to: prev });
  }
  return out;
}

export function keysOf(refs: readonly Ref[]): Set<string> {
  const s = new Set<string>();
  for (const r of refs) for (let i = r.from; i <= r.to; i++) s.add(`${r.surah}:${i}`);
  return s;
}

export interface Coverage {
  /** Ayat in the narrative register (inventory plus the ranges still to research). */
  narrative: number;
  covered: number;
  uncovered: number;
  /** One decimal place. */
  percent: number;
  coveredRanges: Ref[];
  uncoveredRanges: Ref[];
  /** Per surah: narrative and covered ayat, for surahs that have any narrative. */
  bySurah: Array<{ surah: number; narrative: number; covered: number }>;
}

export function computeCoverage(inventory: readonly Ref[], toResearch: readonly Ref[]): Coverage {
  const covered = keysOf(inventory);
  const narrative = new Set([...covered, ...keysOf(toResearch)]);
  const uncovered = [...narrative].filter((k) => !covered.has(k));
  const per = new Map<number, { narrative: number; covered: number }>();
  for (const k of narrative) {
    const s = Number(k.split(":")[0]);
    const row = per.get(s) ?? { narrative: 0, covered: 0 };
    row.narrative++;
    if (covered.has(k)) row.covered++;
    per.set(s, row);
  }
  return {
    narrative: narrative.size,
    covered: covered.size,
    uncovered: uncovered.length,
    percent: narrative.size ? Math.round((covered.size / narrative.size) * 1000) / 10 : 0,
    coveredRanges: rangesOf(covered),
    uncoveredRanges: rangesOf(uncovered),
    bySurah: [...per].sort((a, b) => a[0] - b[0]).map(([surah, v]) => ({ surah, ...v })),
  };
}

export const refsText = (rs: readonly Ref[]) => rs.map(formatRef).join(", ");
