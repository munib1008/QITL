import { TRACKS, type Track } from "./constants";
import type { CategoryRow } from "./types";

/** The category's name in the reader's language; Arabic and Urdu names are required by the database, so no fallback is needed. */
export function categoryName(c: Pick<CategoryRow, "name_en" | "name_ar" | "name_ur">, locale: string): string {
  return locale === "ar" ? c.name_ar : locale === "ur" ? c.name_ur : c.name_en;
}

/** Active, unmerged categories grouped by track and ordered, for pickers and filters. */
export function groupByTrack(categories: CategoryRow[]): Array<{ track: Track; items: CategoryRow[] }> {
  return TRACKS.map((track) => ({
    track,
    items: categories.filter((c) => c.track === track && c.active && !c.merged_into).sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug)),
  })).filter((g) => g.items.length);
}

/** Follow a merge chain to the category that now stands in (bounded; a cycle returns the last step reached). */
export function resolveMerged(categories: CategoryRow[], id: string): string {
  const byId = new Map(categories.map((c) => [c.id, c]));
  let cur = byId.get(id);
  for (let i = 0; i < 10 && cur?.merged_into; i++) cur = byId.get(cur.merged_into) ?? cur;
  return cur?.id ?? id;
}
