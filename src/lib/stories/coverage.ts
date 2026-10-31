/**
 * Story coverage figures, derived from the rows of the staff-only database functions (supabase/migrations/
 * 20261031002552_story_coverage.sql). Pure. Nothing here is typed in by hand and a title existing never counts as
 * coverage: "discovered", "researched", "reviewed" and "published" are four separate counts, never one ladder.
 */
import { computeCoverage, type Coverage } from "@/lib/events/coverage";
import type { Ref } from "@/lib/events/verify";

export interface SubjectRow {
  track: string;
  event_id: string;
  slug: string;
  title: string;
  status: string;
  verse_refs: number;
  verse_refs_verified: number;
  claims: number;
  claims_approved: number;
  hadith_links: number;
  hadith_verified: number;
  chapters: number;
  chapters_drafted: number;
  chapters_reviewed: number;
  chapters_published: number;
  sections: number;
  sections_drafted: number;
  sections_reviewed: number;
  sections_published: number;
  scripts_en: number;
  scripts_ar: number;
  scripts_ur: number;
  translations_pending: number;
  media_approved: number;
  needs_review: number;
  researched: boolean;
  reviewed: boolean;
  published: boolean;
}

export interface FourCounts {
  total: number;
  discovered: number;
  researched: number;
  reviewed: number;
  published: number;
}

/** Discovered = the item exists in the register (so it is `total`); the other three come from the records. */
export function fourCounts(rows: readonly SubjectRow[]): FourCounts {
  return {
    total: rows.length,
    discovered: rows.length,
    researched: rows.filter((r) => r.researched).length,
    reviewed: rows.filter((r) => r.reviewed).length,
    published: rows.filter((r) => r.published).length,
  };
}

export const sum = (rows: readonly SubjectRow[], k: keyof SubjectRow): number => rows.reduce((n, r) => n + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);

export interface IndexedRef {
  source: "event" | "chapter";
  surah: number;
  ayah_from: number;
  ayah_to: number;
  verified: boolean;
}

export interface QuranCoverage {
  /** Ayat of the narrative register (inventory plus the ranges still to research). */
  register: Coverage;
  /** Ayat indexed by any verse reference in the database (event or chapter), verified or not. */
  indexed: Coverage;
  /** Ayat indexed by a reference resting on an approved claim. */
  verified: Coverage;
  /** Ayat of the file inventory, for comparison with what the database holds. */
  inventory: Coverage;
}

/**
 * Quran passages indexed, against content/events/narrative-ranges.json and the event inventory: how many ayat of the
 * narrative register have a verse reference in the database, and how many of those rest on an approved claim.
 */
export function quranCoverage(refs: readonly IndexedRef[], inventory: readonly Ref[], toResearch: readonly Ref[]): QuranCoverage {
  const r = (xs: readonly IndexedRef[]): Ref[] => xs.map((x) => ({ surah: x.surah, from: x.ayah_from, to: x.ayah_to }));
  return {
    register: computeCoverage(inventory, toResearch),
    indexed: computeCoverage(r(refs), toResearch),
    verified: computeCoverage(r(refs.filter((x) => x.verified)), toResearch),
    inventory: computeCoverage(inventory, toResearch),
  };
}

export const TRANSLATION_LANGS = [
  ["en", "scripts_en"],
  ["ar", "scripts_ar"],
  ["ur", "scripts_ur"],
] as const;
