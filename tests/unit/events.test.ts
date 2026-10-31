// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import inventory from "../../content/events/inventory.draft.json";
import narrative from "../../content/events/narrative-ranges.json";
import anchors from "../fixtures/event-anchors.json";
import { computeCoverage, keysOf, rangesOf } from "@/lib/events/coverage";
import { chunk, groupLanes, type UniverseEvent } from "@/lib/events/model";
import { compareInLane, dateLabel, laneOf } from "@/lib/events/ordering";
import { inventorySql, type Inventory } from "@/lib/events/seed-sql";
import { completeHref, filterByTracks, parseTracks, serializeTracks, toggleTrack, TRACK_IDS } from "@/lib/events/tracks";
import { anchorOk, ayahCounts, formatRef, loadQuran, norm, parseRef, rangeExists, rangeHasAnchor } from "@/lib/events/verify";

/**
 * The Event Universe inventory against the imported Quran text. References are checked, never trusted: each must exist
 * in content/quran/quran.txt and must contain the named anchor word of the item it is attached to.
 */
const root = join(__dirname, "..", "..");
const inv = inventory as unknown as Inventory;
const q = loadQuran(root);
type Anchors = Record<string, { refs: Array<[string, string]>; absent?: string[] }>;
const anc = anchors as unknown as Anchors;

describe("the Quran text and the reference checker", () => {
  test("the imported text is complete: 114 surahs, 6236 ayat", () => {
    expect(q.size).toBe(6236);
    const counts = ayahCounts(q);
    expect(counts[1]).toBe(7);
    expect(counts[2]).toBe(286);
    expect(counts[114]).toBe(6);
  });

  test("references parse strictly", () => {
    expect(parseRef("5:27-31")).toEqual({ surah: 5, from: 27, to: 31 });
    expect(parseRef("12:4")).toEqual({ surah: 12, from: 4, to: 4 });
    for (const bad of ["", "0:1", "115:1", "5:0", "5:31-27", "5:27–31x", "five"]) expect(parseRef(bad)).toBeNull();
    expect(formatRef({ surah: 5, from: 27, to: 31 })).toBe("5:27-31");
    expect(rangeExists(q, { surah: 5, from: 27, to: 31 })).toBe(true);
    expect(rangeExists(q, { surah: 1, from: 1, to: 8 })).toBe(false);
    expect(rangeExists(q, { surah: 114, from: 1, to: 6 })).toBe(true);
  });

  test("the anchor matcher finds a name with or without prefixes and pronouns, and does not match a different word", () => {
    // Anchors are single words typed as the Uthmani text spells them.
    expect(rangeHasAnchor(q, { surah: 5, from: 27, to: 31 }, "ادم")).toBe(true);
    expect(rangeHasAnchor(q, { surah: 5, from: 27, to: 31 }, "هابيل")).toBe(false);
    expect(rangeHasAnchor(q, { surah: 5, from: 27, to: 31 }, "قابيل")).toBe(false);
    expect(rangeHasAnchor(q, { surah: 105, from: 1, to: 5 }, "الفيل")).toBe(true);
    expect(rangeHasAnchor(q, { surah: 105, from: 1, to: 5 }, "قريش")).toBe(false);
    expect(rangeHasAnchor(q, { surah: 2, from: 255, to: 255 }, "يوسف")).toBe(false);
    // Spelling variants listed with "/".
    expect(rangeHasAnchor(q, { surah: 6, from: 74, to: 74 }, "ابرهم/ابرهيم")).toBe(true);
    expect(norm("إِبْرَٰهِـۧمَ")).toBe("ابرهم");
    expect(anchorOk("نار")).toBe(true);
    expect(anchorOk("نا")).toBe(false);
  });
});

describe("every seeded verse reference exists in the Quran text", () => {
  test("the inventory file: every reference parses, exists, and contains its item's anchor", () => {
    const problems: string[] = [];
    for (const item of inv.items) {
      const a = anc[item.slug];
      if (!a) {
        problems.push(`${item.slug}: no anchors recorded`);
        continue;
      }
      if (a.refs.length !== item.refs.length) problems.push(`${item.slug}: ${item.refs.length} references but ${a.refs.length} anchors`);
      for (const ref of item.refs) {
        const r = parseRef(ref);
        if (!r) {
          problems.push(`${item.slug}: ${ref} does not parse`);
          continue;
        }
        if (!rangeExists(q, r)) problems.push(`${item.slug}: ${ref} is not in the text`);
        const entry = a.refs.find(([x]) => x === ref);
        if (!entry) problems.push(`${item.slug}: ${ref} has no anchor`);
        else if (!anchorOk(entry[1])) problems.push(`${item.slug}: anchor for ${ref} is too short`);
        else if (!rangeHasAnchor(q, r, entry[1])) problems.push(`${item.slug}: ${ref} does not contain its anchor`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("the migration that seeds the database holds exactly those references, and every one exists in the text", () => {
    const sql = readFileSync(join(root, "supabase", "migrations", "20261031002451_event_universe_inventory.sql"), "utf8");
    expect(sql).toBe(inventorySql(inv)); // regenerate with: pnpm tsx scripts/gen-event-inventory.ts
    const rows = [...sql.matchAll(/^\s+\('([a-z0-9-]+)', (\d+), (\d+), (\d+), (\d+)\)/gm)];
    expect(rows.length).toBe(inv.items.reduce((s, i) => s + i.refs.length, 0));
    for (const [, slug, s, f, t] of rows) {
      const r = { surah: Number(s), from: Number(f), to: Number(t) };
      expect(rangeExists(q, r), `${slug} ${s}:${f}-${t}`).toBe(true);
      expect(inv.items.find((i) => i.slug === slug)?.refs).toContain(formatRef(r));
    }
  });

  test("no item is a duplicate; slugs and tracks are valid; no item carries more than shell fields", () => {
    const slugs = inv.items.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(inv.items.map((i) => i.title)).size).toBe(slugs.length);
    for (const i of inv.items) {
      expect(i.slug).toMatch(/^[a-z0-9-]{2,80}$/);
      expect((TRACK_IDS as readonly string[]).includes(i.track)).toBe(true);
      expect(["sacred_history", "prophetic_life"]).toContain(i.category);
      expect(["quran", "later_tradition"]).toContain(i.name_source);
      expect(i.refs.length).toBeGreaterThan(0);
      // Draft shells: nothing but these fields (no dates, summaries or claims).
      expect(Object.keys(i).sort()).toEqual(["category", "name_source", "refs", "slug", "title", "track"]);
    }
    expect(inv.status).toBe("draft");
    expect(inv.items.length).toBeGreaterThanOrEqual(150);
  });

  test("every track has items, and the parables are all in the parables track", () => {
    for (const t of TRACK_IDS) expect(inv.items.filter((i) => i.track === t).length, t).toBeGreaterThan(5);
  });
});

describe("names: a name not in the Quranic passage is flagged as later tradition", () => {
  const later = inv.items.filter((i) => i.name_source === "later_tradition");

  test("the two sons of Adam are flagged, and Habil and Qabil do not occur in the passage (nor anywhere in the text)", () => {
    const sons = inv.items.find((i) => i.slug === "habil-and-qabil")!;
    expect(sons.name_source).toBe("later_tradition");
    expect(sons.refs).toEqual(["5:27-31"]);
    for (const name of ["هابيل", "قابيل"]) {
      for (const [k] of q) expect(rangeHasAnchor(q, parseRef(k)!, name), `${name} at ${k}`).toBe(false);
    }
  });

  test("every later-tradition item records names that are absent from its passages (the one exception is explained)", () => {
    const UNVERIFIABLE: Record<string, string> = { "battle-of-uhud": "the word أحد occurs in the passage with another meaning (3:153), so absence cannot be tested" };
    for (const i of later) {
      const absent = anc[i.slug]?.absent ?? [];
      if (UNVERIFIABLE[i.slug]) {
        expect(absent).toEqual([]);
        continue;
      }
      expect(absent.length, i.slug).toBeGreaterThan(0);
      for (const name of absent) for (const ref of i.refs) expect(rangeHasAnchor(q, parseRef(ref)!, name), `${i.slug} ${ref} ${name}`).toBe(false);
    }
    expect(later.map((i) => i.slug).sort()).toEqual(["battle-of-uhud", "expedition-of-tabuk", "expulsion-of-banu-nadir", "habil-and-qabil", "hudaybiyyah", "musa-and-the-servant"]);
  });

  test("items flagged as named in the Quran carry no 'absent' names", () => {
    for (const i of inv.items.filter((x) => x.name_source === "quran")) expect(anc[i.slug]?.absent ?? []).toEqual([]);
  });
});

describe("coverage", () => {
  const refs = inv.items.flatMap((i) => i.refs.map((r) => parseRef(r)!));
  const research = narrative.toResearch.map((r) => parseRef(r.ref)!);

  test("every range in the narrative file exists in the text", () => {
    for (const r of [...research, ...narrative.reviewedNotCounted.map((x) => parseRef(x.ref)!)]) expect(rangeExists(q, r)).toBe(true);
  });

  test("the register is the inventory plus the ranges still to research; reviewed-not-counted ranges are left out of it", () => {
    const c = computeCoverage(refs, research);
    expect(c.narrative).toBe(c.covered + c.uncovered);
    expect(c.covered).toBe(keysOf(refs).size);
    expect(c.percent).toBeGreaterThan(80);
    expect(c.percent).toBeLessThan(100);
    // To-research ranges are exactly the uncovered ones (none of them is also in the inventory).
    expect(keysOf(research).size).toBe(c.uncovered);
    const counted = keysOf(narrative.reviewedNotCounted.map((x) => parseRef(x.ref)!));
    for (const k of counted) expect(keysOf(refs).has(k) || keysOf(research).has(k), `${k} is both counted and excluded`).toBe(false);
  });

  test("contiguous ranges are merged per surah in text order", () => {
    expect(rangesOf(["2:5", "2:3", "2:4", "2:9", "1:1"])).toEqual([
      { surah: 1, from: 1, to: 1 },
      { surah: 2, from: 3, to: 5 },
      { surah: 2, from: 9, to: 9 },
    ]);
    const c = computeCoverage([{ surah: 1, from: 1, to: 3 }], [{ surah: 1, from: 3, to: 5 }]);
    expect(c).toMatchObject({ narrative: 5, covered: 3, uncovered: 2, percent: 60 });
    expect(c.uncoveredRanges).toEqual([{ surah: 1, from: 4, to: 5 }]);
  });
});

describe("track filter logic", () => {
  test("absent means every track on, in canonical order", () => {
    expect(parseTracks(undefined)).toEqual([...TRACK_IDS]);
    expect(serializeTracks([...TRACK_IDS])).toBeUndefined();
    expect(completeHref([...TRACK_IDS])).toBe("/timeline?view=complete");
  });

  test("a list, a repeated parameter, an explicit none, and garbage", () => {
    expect(parseTracks("events,prophets")).toEqual(["prophets", "events"]);
    expect(parseTracks(["seerah", "people"])).toEqual(["people", "seerah"]);
    expect(parseTracks("prophets,events")).toEqual(["prophets", "events"]);
    expect(parseTracks("-")).toEqual([]);
    expect(parseTracks("none")).toEqual([]);
    expect(parseTracks(["-", "events"])).toEqual(["events"]); // the no-JavaScript form always sends "-"
    expect(parseTracks("nonsense")).toEqual([...TRACK_IDS]);
    expect(parseTracks("PROPHETS, nonsense")).toEqual(["prophets"]);
    expect(parseTracks("")).toEqual([...TRACK_IDS]);
  });

  test("toggle, serialise and round-trip", () => {
    const sel = toggleTrack([...TRACK_IDS], "parables");
    expect(sel).toEqual(["prophets", "people", "communities", "events", "seerah"]);
    expect(toggleTrack(sel, "parables")).toEqual([...TRACK_IDS]);
    expect(serializeTracks(sel)).toBe("prophets,people,communities,events,seerah");
    expect(parseTracks(serializeTracks(sel))).toEqual(sel);
    expect(serializeTracks([])).toBe("-");
    expect(parseTracks(serializeTracks([]))).toEqual([]);
    expect(completeHref(["events"])).toBe("/timeline?view=complete&tracks=events");
  });

  test("filtering keeps only the selected tracks", () => {
    const items = TRACK_IDS.map((track) => ({ track, id: track }));
    expect(filterByTracks(items, ["events", "parables"]).map((i) => i.id)).toEqual(["events", "parables"]);
    expect(filterByTracks(items, [])).toEqual([]);
  });
});

const ev = (over: Partial<UniverseEvent>): UniverseEvent => ({
  id: "x",
  slug: "x",
  title: "Test item",
  title_ar: null,
  track: "events",
  category: "sacred_history",
  ordering_kind: "unassigned",
  relative_position: null,
  name_source: "quran",
  start_year: null,
  end_year: null,
  start_ah: null,
  end_ah: null,
  dating_method: null,
  evidence: null,
  verses: [{ surah: 12, ayah_from: 4, ayah_to: 5 }],
  connections: [],
  orderViews: [],
  ...over,
});

describe("chronology display: no date unless a historians' dated estimate", () => {
  test("only dated_estimate yields a year label, and never on a parable", () => {
    expect(dateLabel(ev({ ordering_kind: "dated_estimate", start_year: 570, end_year: 571 }))).toBe("c. 570–571 CE");
    expect(dateLabel(ev({ ordering_kind: "dated_estimate", start_year: 570, end_year: 570, start_ah: 53 }))).toContain("AH");
    // Even if a year were stored by mistake, it is not shown for any other kind.
    for (const kind of ["relative", "disputed", "unassigned"] as const) {
      expect(dateLabel(ev({ ordering_kind: kind, start_year: 570, end_year: 571, start_ah: 53 }))).toBeNull();
    }
    expect(dateLabel(ev({ track: "parables", ordering_kind: "dated_estimate", start_year: 570, end_year: 571 }))).toBeNull();
  });

  test("lanes: parables always get their own lane; unassigned items are 'order not established'", () => {
    expect(laneOf(ev({ track: "parables", ordering_kind: "relative" }))).toBe("parable");
    expect(laneOf(ev({ ordering_kind: "unassigned" }))).toBe("not_established");
    expect(laneOf(ev({ ordering_kind: "relative", relative_position: 2 }))).toBe("relative");
    expect(laneOf(ev({ ordering_kind: "disputed" }))).toBe("disputed");
    expect(laneOf(ev({ ordering_kind: "dated_estimate", start_year: 1, end_year: 2 }))).toBe("dated");
  });

  test("grouping: lanes in order, relative items sorted by position, empty lanes left out", () => {
    const items = [
      ev({ id: "a", title: "A", ordering_kind: "relative", relative_position: 5 }),
      ev({ id: "b", title: "B", ordering_kind: "relative", relative_position: 2 }),
      ev({ id: "c", title: "C", track: "parables" }),
      ev({ id: "d", title: "D" }),
    ];
    const g = groupLanes(items);
    expect(g.map((x) => x.lane)).toEqual(["relative", "not_established", "parable"]);
    expect(g[0]!.eras[0]!.items.map((i) => i.id)).toEqual(["b", "a"]);
    expect(compareInLane({ ...items[0]!, title: "A" }, { ...items[1]!, title: "B" })).toBeGreaterThan(0);
  });

  test("chunking splits a long list into a first screen and further steps", () => {
    const list = Array.from({ length: 200 }, (_, i) => i);
    const c = chunk(list);
    expect(c[0]).toHaveLength(24);
    expect(c.slice(1).every((p) => p.length <= 48)).toBe(true);
    expect(c.flat()).toEqual(list);
    expect(chunk([1, 2, 3])).toEqual([[1, 2, 3]]);
  });
});
