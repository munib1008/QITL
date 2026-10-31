/** Types and grouping for the Complete Timeline (pure: no database, no server-only). */
import { compareInLane, laneOf, LANES, type Lane, type OrderingKind } from "./ordering";
import { type TrackId } from "./tracks";

export interface VerseRef {
  surah: number;
  ayah_from: number;
  ayah_to: number;
}

export interface ConnectionLink {
  kind: "involves" | "takes_place_at" | "same_community" | "related" | "lineage";
  target_kind: "event" | "person" | "community" | "place";
  label: string;
  /** Slug of the person, place or event on its own page. */
  slug: string;
}

export interface OrderView {
  view: string;
  standing: string;
}

export interface UniverseEvent {
  id: string;
  slug: string;
  title: string;
  title_ar: string | null;
  track: TrackId;
  category: "sacred_history" | "prophetic_life" | "islamic_history";
  ordering_kind: OrderingKind;
  relative_position: number | null;
  name_source: "quran" | "later_tradition";
  start_year: number | null;
  end_year: number | null;
  start_ah: number | null;
  end_ah: number | null;
  dating_method: string | null;
  evidence: "quran" | "hadith" | "scholar" | "estimate" | "disputed" | "unknown" | null;
  verses: VerseRef[];
  connections: ConnectionLink[];
  orderViews: OrderView[];
}

export interface Era {
  key: string;
  items: UniverseEvent[];
}
export interface LaneGroup {
  lane: Lane;
  eras: Era[];
  count: number;
}

/** Lanes in display order; a lane with no items is left out. Eras group by category, or by track where order is unknown. */
export function groupLanes(items: readonly UniverseEvent[]): LaneGroup[] {
  const out: LaneGroup[] = [];
  for (const lane of LANES) {
    const inLane = items.filter((i) => laneOf(i) === lane).sort(compareInLane);
    if (!inLane.length) continue;
    const eras = new Map<string, UniverseEvent[]>();
    for (const i of inLane) {
      const key = lane === "relative" || lane === "dated" || lane === "disputed" ? i.category : lane === "not_established" ? i.track : "parables";
      eras.set(key, [...(eras.get(key) ?? []), i]);
    }
    out.push({ lane, eras: [...eras].map(([key, list]) => ({ key, items: list })), count: inLane.length });
  }
  return out;
}

/** Split a long list into native-disclosure chunks (no JavaScript needed): the first `first` open, the rest in steps of `step`. */
export function chunk<T>(list: readonly T[], first = 24, step = 48): T[][] {
  if (list.length <= first) return [list.slice()];
  const out: T[][] = [list.slice(0, first)];
  for (let i = first; i < list.length; i += step) out.push(list.slice(i, i + step));
  return out;
}

export interface UniverseCounts {
  published: number;
  under_review: number;
  byTrack: Array<{ track: TrackId; published: number; under_review: number }>;
}

export function verseText(v: VerseRef): string {
  return v.ayah_from === v.ayah_to ? `${v.surah}:${v.ayah_from}` : `${v.surah}:${v.ayah_from}–${v.ayah_to}`;
}
