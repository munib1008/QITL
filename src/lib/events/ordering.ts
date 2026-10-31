/**
 * How an item is placed on the Complete Timeline. There are no invented dates: only a historians' dated estimate
 * (ordering_kind 'dated_estimate', class C) ever shows a year. Everything else shows how it is ordered, or that it is not.
 */
import { formatRange } from "@/lib/years";
import type { TrackId } from "./tracks";

export type OrderingKind = "relative" | "disputed" | "unassigned" | "dated_estimate";
export type Lane = "relative" | "dated" | "disputed" | "not_established" | "parable";
export const LANES: readonly Lane[] = ["relative", "dated", "disputed", "not_established", "parable"];

export interface Placement {
  track: TrackId;
  ordering_kind: OrderingKind;
  relative_position: number | null;
  start_year: number | null;
  end_year: number | null;
  start_ah: number | null;
  end_ah: number | null;
}

/** Parables are never ordered or dated; they have their own lane whatever else is stored. */
export function laneOf(p: Pick<Placement, "track" | "ordering_kind">): Lane {
  if (p.track === "parables") return "parable";
  switch (p.ordering_kind) {
    case "relative":
      return "relative";
    case "dated_estimate":
      return "dated";
    case "disputed":
      return "disputed";
    default:
      return "not_established";
  }
}

/** The CE (and, where reviewed, AH) label. null unless the item is a historians' dated estimate. */
export function dateLabel(p: Placement): string | null {
  if (p.track === "parables" || p.ordering_kind !== "dated_estimate") return null;
  return formatRange(p.start_year, p.end_year, p.start_ah, p.end_ah, true) ?? null;
}

/** Sort key inside a lane: relative position, then year, then title (stable and deterministic). */
export function compareInLane(a: Placement & { title: string }, b: Placement & { title: string }): number {
  const pa = a.relative_position ?? Number.MAX_SAFE_INTEGER;
  const pb = b.relative_position ?? Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;
  const ya = a.start_year ?? Number.MAX_SAFE_INTEGER;
  const yb = b.start_year ?? Number.MAX_SAFE_INTEGER;
  if (ya !== yb) return ya - yb;
  return a.title.localeCompare(b.title);
}
