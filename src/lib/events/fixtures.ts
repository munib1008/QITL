import type { UniverseCounts, UniverseEvent } from "./model";
import { TRACK_IDS, type TrackId } from "./tracks";

/**
 * Synthetic items for the automated browser tests (active only with QITL_E2E_FIXTURES=1 and no Supabase; see
 * src/lib/e2e-fixtures.ts). Titles say "Test item"; verse references are real references so the links work, but the
 * items are not real events and carry no narrative.
 */
const base = {
  title_ar: null,
  start_year: null,
  end_year: null,
  start_ah: null,
  end_ah: null,
  dating_method: null,
  evidence: "scholar" as const,
  connections: [],
  orderViews: [],
  name_source: "quran" as const,
  relative_position: null,
  ordering_kind: "unassigned" as const,
  category: "sacred_history" as const,
};

const one = (slug: string, track: TrackId, over: Partial<UniverseEvent> = {}): UniverseEvent => ({
  ...base,
  id: `fx-${slug}`,
  slug,
  title: `Test item: ${slug.replace(/^fixture-/, "").replace(/-/g, " ")}`,
  track,
  verses: [{ surah: 12, ayah_from: 4, ayah_to: 5 }],
  ...over,
});

export function fixtureEvents(): UniverseEvent[] {
  const list: UniverseEvent[] = [
    one("fixture-prophet-a", "prophets", { ordering_kind: "relative", relative_position: 1 }),
    one("fixture-prophet-b", "prophets", { ordering_kind: "relative", relative_position: 2, verses: [{ surah: 12, ayah_from: 4, ayah_to: 5 }, { surah: 12, ayah_from: 7, ayah_to: 9 }] }),
    one("fixture-prophet-c", "prophets", { ordering_kind: "disputed", orderViews: [{ view: "Synthetic view one", standing: "disputed" }, { view: "Synthetic view two", standing: "disputed" }] }),
    one("fixture-person-a", "people", { name_source: "later_tradition", connections: [{ kind: "lineage", target_kind: "person", label: "Test person", slug: "fixture-parent" }] }),
    one("fixture-person-b", "people"),
    one("fixture-community-a", "communities", { ordering_kind: "relative", relative_position: 3, connections: [{ kind: "takes_place_at", target_kind: "place", label: "Test place", slug: "fixture-place" }] }),
    one("fixture-community-b", "communities"),
    one("fixture-event-a", "events", { ordering_kind: "relative", relative_position: 4 }),
    one("fixture-event-dated", "events", { category: "prophetic_life", ordering_kind: "dated_estimate", start_year: 570, end_year: 571, dating_method: "Synthetic method for testing only" }),
    one("fixture-event-b", "events"),
    one("fixture-parable-a", "parables"),
    one("fixture-parable-b", "parables"),
    one("fixture-seerah-a", "seerah", { category: "prophetic_life" }),
  ];
  // Enough items in the not-established lane to exercise the chunked "Show more" disclosure.
  for (let i = 1; i <= 30; i++) list.push(one(`fixture-bulk-${String(i).padStart(2, "0")}`, TRACK_IDS[i % 4 === 0 ? 3 : 1]!));
  return list;
}

export function fixtureCounts(): UniverseCounts {
  const events = fixtureEvents();
  const byTrack = TRACK_IDS.map((track) => ({ track, published: events.filter((e) => e.track === track).length, under_review: 7 }));
  return { published: events.length, under_review: byTrack.reduce((s, r) => s + r.under_review, 0), byTrack };
}
