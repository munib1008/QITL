// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * The Event Universe (migrations 20261031002450 and 20261031002451): the inventory seed, chronology constraints
 * (no invented dates), publish guards, draft invisibility, name and identification claims, and merge with redirects.
 * Fixture text is a labelled placeholder, never religious text.
 */
const FIXTURE = "[TEST FIXTURE — placeholder, not Quran or hadith text]";
const inventory = JSON.parse(readFileSync(join(__dirname, "..", "..", "content", "events", "inventory.draft.json"), "utf8")) as {
  items: Array<{ slug: string; track: string; refs: string[] }>;
};

let db: Db;
let editor: string, reviewer: string, scientist: string, admin: string, alice: string;
let sourceId: string;
let n = 0;

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("ev-editor@test.local", ["editor"]);
  reviewer = await db.createUser("ev-reviewer@test.local", ["scholarly_reviewer"]);
  scientist = await db.createUser("ev-scientist@test.local", ["science_reviewer"]);
  admin = await db.createUser("ev-admin@test.local", ["admin"]);
  alice = await db.createUser("ev-alice@test.local");
  [{ id: sourceId }] = (await db.admin<{ id: string }>(
    "insert into public.sources (type, work, rights_status, source_url) values ('history', 'Test publication', 'cleared', 'https://example.test') returning id",
  )) as [{ id: string }];
  const [{ id: versionId }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [sourceId],
  )) as [{ id: string }];
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (12, 'x', 'Fixture', 111, $1)", [versionId]);
  for (let a = 1; a <= 5; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (12, $1, $2, $3)", [a, FIXTURE, versionId]);
}, 180_000);

/** An approved claim (reference + scholarly approval), optionally an estimate with a cited publication. */
async function approvedClaim(opts: { evidence?: string; history?: boolean } = {}): Promise<string> {
  const [c] = await db.as<{ id: string }>(
    editor,
    "insert into public.evidence_claims (statement, evidence, created_by) values ($1, $2, $3) returning id",
    [`Fixture claim ${++n} for the event universe tests`, opts.evidence ?? "quran", editor],
  );
  if (opts.history) {
    await db.as(editor, "insert into public.claim_references (claim_id, kind, source_id, locator) values ($1, 'history', $2, 'p. 1')", [c!.id, sourceId]);
  } else {
    await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from, quran_ayah_to) values ($1, 'quran', 12, 4, 5)", [c!.id]);
  }
  await db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [c!.id, reviewer]);
  await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [c!.id]);
  return c!.id;
}

async function mkEvent(slug: string, o: { track?: string; kind?: string; precision?: string; position?: number | null; nameSource?: string; category?: string } = {}): Promise<string> {
  const kind = o.kind ?? "unassigned";
  const precision = o.precision ?? (kind === "relative" ? "relative" : "unknown");
  const [e] = await db.as<{ id: string }>(
    editor,
    `insert into public.historical_events (slug, title, category, date_precision, track, ordering_kind, relative_position, name_source)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [slug, `Fixture ${slug}`, o.category ?? "sacred_history", precision, o.track ?? "events", kind, o.position ?? (kind === "relative" ? 1 : null), o.nameSource ?? "quran"],
  );
  return e!.id;
}

const review = (type: string, id: string, who = reviewer) =>
  db.as(who, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ($1, $2, $3, 'approved')", [type, id, who]);
const publish = (id: string) => db.as(editor, "update public.historical_events set status = 'published' where id = $1", [id]);

/** The base every publishable event shares: an approved event claim, the event review, and one verse reference on an approved claim. */
async function base(id: string): Promise<string> {
  const claim = await approvedClaim();
  await db.as(editor, "insert into public.event_claims (event_id, claim_id) values ($1, $2)", [id, claim]);
  await review("event", id);
  await db.as(editor, "insert into public.event_verse_refs (event_id, surah, ayah_from, ayah_to, claim_id) values ($1, 12, 4, 5, $2)", [id, claim]);
  return claim;
}

async function orderingClaim(eventId: string, view: string): Promise<string> {
  const claim = await approvedClaim();
  const [i] = await db.as<{ id: string }>(
    editor,
    "insert into public.event_identifications (event_id, kind, subject, view, standing, claim_id) values ($1, 'ordering', 'Order', $2, 'widely_held', $3) returning id",
    [eventId, view, claim],
  );
  // Identifications are reviewed and published before the event (they stay invisible until the event is public).
  await review("event_identification", i!.id);
  await db.as(editor, "update public.event_identifications set status = 'published' where id = $1", [i!.id]);
  return i!.id;
}

describe("the inventory seed", () => {
  test("every inventory item is a draft shell with no date, no order and no public visibility", async () => {
    const rows = await db.admin<{ n: number }>(
      "select count(*)::int n from public.historical_events where track is not null and status = 'draft' and ordering_kind = 'unassigned' and date_precision = 'unknown' and start_year is null and end_year is null and start_ah is null and end_ah is null and relative_position is null and claim_id is null and summary is null",
    );
    expect(rows[0]!.n).toBe(inventory.items.length);
    const all = await db.admin<{ n: number }>("select count(*)::int n from public.historical_events where track is not null");
    expect(all[0]!.n).toBe(inventory.items.length);
  });

  test("tracks and verse references match the reviewed inventory file", async () => {
    const byTrack = await db.admin<{ track: string; n: number }>("select track, count(*)::int n from public.historical_events where track is not null group by track order by track");
    const want = new Map<string, number>();
    for (const i of inventory.items) want.set(i.track, (want.get(i.track) ?? 0) + 1);
    expect(Object.fromEntries(byTrack.map((r) => [r.track, r.n]))).toEqual(Object.fromEntries([...want].sort()));
    const refs = await db.admin<{ n: number }>("select count(*)::int n from public.event_verse_refs");
    expect(refs[0]!.n).toBe(inventory.items.reduce((s, i) => s + i.refs.length, 0));
    // Every inventory item has at least one verse; none has a claim yet.
    const bare = await db.admin<{ n: number }>("select count(*)::int n from public.historical_events e where e.track is not null and not exists (select 1 from public.event_verse_refs r where r.event_id = e.id)");
    expect(bare[0]!.n).toBe(0);
    const claimed = await db.admin<{ n: number }>("select count(*)::int n from public.event_verse_refs where claim_id is not null");
    expect(claimed[0]!.n).toBe(0);
  });

  test("the public sees none of it: not the events, not the verse references; only counts", async () => {
    expect(await db.as(null, "select slug from public.historical_events where track is not null")).toEqual([]);
    expect(await db.as(null, "select id from public.event_verse_refs")).toEqual([]);
    expect(await db.as(alice, "select id from public.event_verse_refs")).toEqual([]);
    const stats = await db.as<{ track: string; published: number; under_review: number }>(null, "select track, published, under_review from public.event_universe_stats order by track");
    expect(stats.reduce((s, r) => s + r.under_review, 0)).toBe(inventory.items.length);
    expect(stats.reduce((s, r) => s + r.published, 0)).toBe(0);
    expect(stats.map((r) => r.track)).toEqual(["communities", "events", "parables", "people", "prophets", "seerah"]);
    // Staff can read the drafts.
    expect((await db.as(editor, "select count(*)::int n from public.historical_events where track is not null"))[0]).toEqual({ n: inventory.items.length });
  });

  test("the later-tradition names are flagged in the seed", async () => {
    const rows = await db.admin<{ slug: string }>("select slug from public.historical_events where name_source = 'later_tradition' order by slug");
    expect(rows.map((r) => r.slug)).toContain("habil-and-qabil");
    expect(rows.map((r) => r.slug)).toContain("hudaybiyyah");
  });
});

describe("chronology: no invented dates", () => {
  test("only a relative item has a position, and only a dated estimate has years", async () => {
    await rejects(db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, track, ordering_kind, relative_position) values ('c-pos', 'x', 'sacred_history', 'unknown', 'prophets', 'unassigned', 3)"), /position_kind/);
    await rejects(db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, track, ordering_kind) values ('c-rel', 'x', 'sacred_history', 'relative', 'prophets', 'relative')"), /position_kind|relative_order|universe_shape|violates check/);
    await rejects(db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, track, ordering_kind, start_year) values ('c-yr', 'x', 'sacred_history', 'unknown', 'prophets', 'unassigned', -3000)"), /violates check/);
    await rejects(db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, track, ordering_kind, relative_position, start_year) values ('c-yr2', 'x', 'sacred_history', 'relative', 'prophets', 'relative', 1, 600)"), /violates check/);
  });

  test("a parable is never ordered or dated; prophets, people and communities are never given a dated estimate", async () => {
    await rejects(db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, track, ordering_kind, relative_position) values ('c-par', 'x', 'sacred_history', 'relative', 'parables', 'relative', 1)"), /parables_undated/);
    await rejects(db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, track, ordering_kind) values ('c-par2', 'x', 'sacred_history', 'unknown', 'parables', 'disputed')"), /parables_undated/);
    await rejects(
      db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, track, ordering_kind, start_year, end_year, dating_method) values ('c-prophet-date', 'x', 'prophetic_life', 'estimated', 'prophets', 'dated_estimate', 570, 571, 'Method')"),
      /dated_tracks/,
    );
    // The seerah may carry a historians' estimate, but only with its basis recorded.
    await rejects(
      db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, track, ordering_kind, start_year, end_year) values ('c-no-basis', 'x', 'prophetic_life', 'estimated', 'seerah', 'dated_estimate', 570, 571)"),
      /estimate_basis/,
    );
    await db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, track, ordering_kind, start_year, end_year, dating_method) values ('c-ok-draft', 'x', 'prophetic_life', 'estimated', 'seerah', 'dated_estimate', 570, 571, 'Method')");
  });

  test("an item without a track carries none of the new fields (the existing reviewed events are unaffected)", async () => {
    await rejects(db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, ordering_kind) values ('c-legacy', 'x', 'sacred_history', 'unknown', 'unassigned')"), /universe_shape/);
    await db.as(editor, "insert into public.historical_events (slug, title, category, date_precision) values ('c-legacy-ok', 'x', 'sacred_history', 'unknown')");
  });
});

describe("publish guards", () => {
  test("verses on approved claims, a cited basis for relative order, and the usual review", async () => {
    const id = await mkEvent("g-rel", { track: "events", kind: "relative", position: 4 });
    await rejects(publish(id), /no evidence, no publish/); // the existing event guard: no claims at all
    const claim = await approvedClaim();
    await db.as(editor, "insert into public.event_claims (event_id, claim_id) values ($1, $2)", [id, claim]);
    await review("event", id);
    await rejects(publish(id), /no verses, no publish/);
    // A reference on an unapproved claim is not enough.
    const [draftClaim] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ('Unapproved fixture claim', 'quran', $1) returning id", [editor]);
    await db.as(editor, "insert into public.event_verse_refs (event_id, surah, ayah_from, ayah_to, claim_id) values ($1, 12, 1, 2, $2)", [id, draftClaim!.id]);
    await rejects(publish(id), /without an approved claim/);
    await db.as(editor, "update public.event_verse_refs set claim_id = $2 where event_id = $1", [id, claim]);
    // Relative order needs a cited ordering claim: no invented order.
    await rejects(publish(id), /relative order needs a cited ordering claim/);
    await orderingClaim(id, "Follows the earlier event in the Quranic account");
    await publish(id);
    expect(await db.as(null, "select slug from public.historical_events where id = $1", [id])).toEqual([{ slug: "g-rel" }]);
    expect(await db.as(null, "select surah from public.event_verse_refs where event_id = $1", [id])).toHaveLength(1);
  });

  test("an unassigned item publishes as 'order not established', with no order claim", async () => {
    const id = await mkEvent("g-unassigned", { track: "communities" });
    await base(id);
    await publish(id);
    const [r] = await db.as<{ ordering_kind: string; relative_position: number | null; start_year: number | null }>(null, "select ordering_kind, relative_position, start_year from public.historical_events where id = $1", [id]);
    expect(r).toEqual({ ordering_kind: "unassigned", relative_position: null, start_year: null });
  });

  test("a disputed order lists at least two cited views", async () => {
    const id = await mkEvent("g-disputed", { track: "prophets", kind: "disputed" });
    await base(id);
    await orderingClaim(id, "View one");
    await rejects(publish(id), /at least two cited views/);
    await orderingClaim(id, "View two");
    await publish(id);
  });

  test("a name from later tradition needs a cited name claim", async () => {
    const id = await mkEvent("g-later", { track: "people", nameSource: "later_tradition" });
    await base(id);
    await rejects(publish(id), /name from later tradition/);
    const claim = await approvedClaim({ evidence: "scholar", history: true });
    const [i] = await db.as<{ id: string }>(editor, "insert into public.event_identifications (event_id, kind, subject, view, standing, claim_id) values ($1, 'name', 'Names of the two sons', 'Named in later tradition, not in the passage', 'later_tradition', $2) returning id", [id, claim]);
    await review("event_identification", i!.id);
    await db.as(editor, "update public.event_identifications set status = 'published' where id = $1", [i!.id]);
    await publish(id);
    expect(await db.as(null, "select view from public.event_identifications where event_id = $1", [id])).toEqual([{ view: "Named in later tradition, not in the passage" }]);
  });

  test("a historians' dated estimate: a named publication, class C evidence and the historical/scientific review", async () => {
    const quranClaim = await approvedClaim({ evidence: "quran" });
    const estimate = await approvedClaim({ evidence: "estimate", history: true });
    const id = (await db.as<{ id: string }>(
      editor,
      "insert into public.historical_events (slug, title, category, date_precision, track, ordering_kind, start_year, end_year, dating_method) values ('g-dated', 'Fixture dated', 'prophetic_life', 'estimated', 'seerah', 'dated_estimate', 570, 571, 'Fixture dating method') returning id",
    ))[0]!.id;
    await base(id);
    const dating = async (claim: string, view: string) => {
      const [i] = await db.as<{ id: string }>(editor, "insert into public.event_identifications (event_id, kind, subject, view, standing, claim_id) values ($1, 'dating', 'Date', $2, 'widely_held', $3) returning id", [id, view, claim]);
      await review("event_identification", i!.id);
      await db.as(editor, "update public.event_identifications set status = 'published' where id = $1", [i!.id]);
    };
    await rejects(publish(id), /needs a published dating claim/);
    await dating(quranClaim, "A claim that is not an estimate");
    await rejects(publish(id), /evidence class C/);
    await dating(estimate, "A historians' estimate from a named publication");
    await rejects(publish(id), /historical\/scientific review/);
    // The scholarly reviewer may not sign the dating; the author may not either; the science reviewer may.
    await rejects(db.as(reviewer, "insert into public.event_dating_reviews (event_id, reviewer_id, decision) values ($1, $2, 'approved')", [id, reviewer]), /row-level security|scientific reviewer/);
    await rejects(db.as(alice, "insert into public.event_dating_reviews (event_id, reviewer_id, decision) values ($1, $2, 'approved')", [id, alice]), /row-level security|permission denied|scientific reviewer/);
    await db.as(scientist, "insert into public.event_dating_reviews (event_id, reviewer_id, decision) values ($1, $2, 'changes_requested')", [id, scientist]);
    await rejects(publish(id), /historical\/scientific review/);
    await db.as(scientist, "insert into public.event_dating_reviews (event_id, reviewer_id, decision) values ($1, $2, 'approved')", [id, scientist]);
    await publish(id);
    const [r] = await db.as<{ ordering_kind: string; start_year: number; date_precision: string }>(null, "select ordering_kind, start_year, date_precision from public.historical_events where id = $1", [id]);
    expect(r).toEqual({ ordering_kind: "dated_estimate", start_year: 570, date_precision: "estimated" });
  });

  test("the science reviewer cannot be the event's author", async () => {
    const sciEditor = await db.createUser("ev-sci-editor@test.local", ["editor", "science_reviewer"]);
    const [e] = await db.as<{ id: string }>(
      sciEditor,
      "insert into public.historical_events (slug, title, category, date_precision, track, ordering_kind, start_year, end_year, dating_method) values ('g-self-date', 'x', 'prophetic_life', 'estimated', 'seerah', 'dated_estimate', 570, 571, 'Method') returning id",
    );
    await rejects(db.as(sciEditor, "insert into public.event_dating_reviews (event_id, reviewer_id, decision) values ($1, $2, 'approved')", [e!.id, sciEditor]), /cannot review their own/);
  });

  test("a published event's track, order and dating are fixed; so are its verses", async () => {
    const id = await mkEvent("g-fixed", { track: "events" });
    await base(id);
    await publish(id);
    await rejects(db.as(editor, "update public.historical_events set track = 'seerah' where id = $1", [id]), /fixed/);
    await rejects(db.as(editor, "update public.historical_events set name_source = 'later_tradition' where id = $1", [id]), /fixed/);
    await rejects(db.as(editor, "insert into public.event_verse_refs (event_id, surah, ayah_from, ayah_to) values ($1, 12, 3, 3)", [id]), /fixed/);
    await rejects(db.as(editor, "delete from public.event_verse_refs where event_id = $1", [id]), /fixed/);
    // The title can still be corrected, and a correction reopens the fields.
    await db.as(editor, "update public.historical_events set title = 'Fixture fixed, corrected' where id = $1", [id]);
    await db.as(editor, "update public.historical_events set status = 'correction' where id = $1", [id]);
    await db.as(editor, "insert into public.event_verse_refs (event_id, surah, ayah_from, ayah_to) values ($1, 12, 3, 3)", [id]);
  });

  test("a verse reference must end inside the surah", async () => {
    const id = await mkEvent("g-range", { track: "events" });
    await rejects(db.as(editor, "insert into public.event_verse_refs (event_id, surah, ayah_from, ayah_to) values ($1, 12, 1, 999)", [id]), /outside the surah/);
    await rejects(db.as(editor, "insert into public.event_verse_refs (event_id, surah, ayah_from, ayah_to) values ($1, 12, 3, 2)", [id]), /violates check/);
    await rejects(db.as(editor, "insert into public.event_verse_refs (event_id, surah, ayah_from, ayah_to) values ($1, 115, 1, 1)", [id]), /violates check/);
  });
});

describe("identification claims", () => {
  test("a traditional identification is a cited claim, never a Quranic one; disputed views are listed together once published", async () => {
    const id = await mkEvent("i-ident", { track: "people" });
    await base(id);
    await publish(id);
    const quranClaim = await approvedClaim({ evidence: "quran" });
    const [bad] = await db.as<{ id: string }>(editor, "insert into public.event_identifications (event_id, kind, subject, view, claim_id) values ($1, 'identification', 'Who was he', 'He was X', $2) returning id", [id, quranClaim]);
    await review("event_identification", bad!.id);
    await rejects(db.as(editor, "update public.event_identifications set status = 'published' where id = $1", [bad!.id]), /not a Quranic claim/);

    const views: string[] = [];
    for (const v of ["View A", "View B", "View C"]) {
      const claim = await approvedClaim({ evidence: "scholar", history: true });
      const [row] = await db.as<{ id: string }>(editor, "insert into public.event_identifications (event_id, kind, subject, view, standing, claim_id) values ($1, 'identification', 'Who was he', $2, 'disputed', $3) returning id", [id, v, claim]);
      views.push(row!.id);
    }
    // Unreviewed: still invisible. Reviewed and published: all views are public together.
    expect(await db.as(null, "select view from public.event_identifications where event_id = $1", [id])).toEqual([]);
    await rejects(db.as(editor, "update public.event_identifications set status = 'published' where id = $1", [views[0]]), /no review, no publish/);
    for (const v of views) {
      await review("event_identification", v);
      await db.as(editor, "update public.event_identifications set status = 'published' where id = $1", [v]);
    }
    const seen = await db.as<{ view: string }>(null, "select view from public.event_identifications where event_id = $1 order by view", [id]);
    expect(seen.map((r) => r.view)).toEqual(["View A", "View B", "View C"]);
  });

  test("an editor who is also a reviewer cannot approve their own identification or connection; the author column is stamped", async () => {
    const both = await db.createUser("ev-both@test.local", ["editor", "scholarly_reviewer"]);
    const id = await mkEvent("i-self", { track: "people" });
    const claim = await approvedClaim({ evidence: "scholar", history: true });
    const [i] = await db.as<{ id: string; created_by: string }>(both, "insert into public.event_identifications (event_id, kind, subject, view, claim_id, created_by) values ($1, 'identification', 'Who', 'A view', $2, $3) returning id, created_by", [id, claim, editor]);
    expect(i!.created_by).toBe(both);
    await rejects(review("event_identification", i!.id, both), /cannot review their own/);
  });
});

describe("connections", () => {
  test("a connection has exactly one target, a community connection points at the communities track, a place link only for 'takes place at'", async () => {
    const a = await mkEvent("k-a", { track: "events" });
    const comm = await mkEvent("k-comm", { track: "communities" });
    const other = await mkEvent("k-other", { track: "events" });
    const claim = await approvedClaim({ evidence: "scholar", history: true });
    await db.as(editor, "insert into public.event_connections (event_id, target_kind, target_event_id, kind, claim_id) values ($1, 'community', $2, 'same_community', $3)", [a, comm, claim]);
    await rejects(db.as(editor, "insert into public.event_connections (event_id, target_kind, target_event_id, kind, claim_id) values ($1, 'community', $2, 'same_community', $3)", [a, other, claim]), /communities track/);
    await rejects(db.as(editor, "insert into public.event_connections (event_id, target_kind, target_event_id, kind, claim_id) values ($1, 'event', $1, 'related', $2)", [a, claim]), /violates check/);
    await rejects(db.as(editor, "insert into public.event_connections (event_id, target_kind, kind, claim_id) values ($1, 'person', 'involves', $2)", [a, claim]), /violates check/);
    await rejects(db.as(editor, "insert into public.event_connections (event_id, target_kind, target_event_id, kind, claim_id) values ($1, 'event', $2, 'takes_place_at', $3)", [a, other, claim]), /violates check/);
    await rejects(db.as(editor, "insert into public.event_connections (event_id, target_kind, target_event_id, kind, claim_id) values ($1, 'community', $2, 'same_community', $3)", [a, comm, claim]), /duplicate key/);
  });

  test("connections are public only when they and their event are published, and need a review", async () => {
    const a = await mkEvent("k-pub", { track: "events" });
    const b = await mkEvent("k-pub-target", { track: "events" });
    await base(a);
    const claim = await approvedClaim({ evidence: "scholar", history: true });
    const [c] = await db.as<{ id: string }>(editor, "insert into public.event_connections (event_id, target_kind, target_event_id, kind, claim_id) values ($1, 'event', $2, 'related', $3) returning id", [a, b, claim]);
    await rejects(db.as(editor, "update public.event_connections set status = 'published' where id = $1", [c!.id]), /no review, no publish/);
    await review("event_connection", c!.id);
    await db.as(editor, "update public.event_connections set status = 'published' where id = $1", [c!.id]);
    expect(await db.as(null, "select id from public.event_connections where id = $1", [c!.id])).toEqual([]); // event still a draft
    await publish(a);
    expect(await db.as(null, "select id from public.event_connections where id = $1", [c!.id])).toHaveLength(1);
  });
});

describe("draft invisibility and counts", () => {
  test("a draft's verses, identifications and redirects are hidden from the public and from ordinary users", async () => {
    const id = await mkEvent("d-hidden", { track: "events" });
    await db.as(editor, "insert into public.event_verse_refs (event_id, surah, ayah_from, ayah_to) values ($1, 12, 1, 2)", [id]);
    for (const who of [null, alice]) {
      expect(await db.as(who, "select id from public.event_verse_refs where event_id = $1", [id])).toEqual([]);
      expect(await db.as(who, "select slug from public.historical_events where id = $1", [id])).toEqual([]);
    }
    expect(await db.as(reviewer, "select id from public.event_verse_refs where event_id = $1", [id])).toHaveLength(1);
    // The science reviewer can read universe drafts to review the dating, and nothing else changes.
    expect(await db.as(scientist, "select slug from public.historical_events where id = $1", [id])).toEqual([{ slug: "d-hidden" }]);
  });

  test("the counts move with the status and carry no content", async () => {
    const before = (await db.as<{ published: number; under_review: number }>(null, "select published, under_review from public.event_universe_stats where track = 'seerah'"))[0]!;
    const id = await mkEvent("d-count", { track: "seerah", category: "prophetic_life" });
    const mid = (await db.as<{ published: number; under_review: number }>(null, "select published, under_review from public.event_universe_stats where track = 'seerah'"))[0]!;
    expect(mid.under_review).toBe(before.under_review + 1);
    await base(id);
    await publish(id);
    const after = (await db.as<{ published: number; under_review: number }>(null, "select published, under_review from public.event_universe_stats where track = 'seerah'"))[0]!;
    expect(after).toEqual({ published: before.published + 1, under_review: before.under_review });
    await rejects(db.as(editor, "update public.event_universe_stats set published = 99"), /permission denied|row-level security/);
    await rejects(db.as(null, "update public.event_universe_stats set published = 99"), /permission denied/);
  });
});

describe("merge", () => {
  test("two drafts that are the same: claims, verses and identifications move, the source redirects and is archived", async () => {
    const s = await mkEvent("m-source", { track: "events" });
    const t = await mkEvent("m-target", { track: "events" });
    const claimS = await approvedClaim();
    await db.as(editor, "insert into public.event_claims (event_id, claim_id) values ($1, $2)", [s, claimS]);
    await db.as(editor, "insert into public.event_verse_refs (event_id, surah, ayah_from, ayah_to, claim_id) values ($1, 12, 1, 2, $2), ($1, 12, 4, 5, $2), ($3, 12, 4, 5, null)", [s, claimS, t]);
    const idClaim = await approvedClaim({ evidence: "scholar", history: true });
    await db.as(editor, "insert into public.event_identifications (event_id, kind, subject, view, claim_id) values ($1, 'identification', 'Who', 'View', $2)", [s, idClaim]);
    const other = await mkEvent("m-other", { track: "events" });
    await db.as(editor, "insert into public.event_connections (event_id, target_kind, target_event_id, kind, claim_id) values ($1, 'event', $2, 'related', $3), ($2, 'event', $1, 'related', $3), ($1, 'event', $4, 'related', $3)", [s, other, idClaim, t]);

    await rejects(db.as(alice, "select public.merge_events($1, $2)", [s, t]), /only an editor/);
    await rejects(db.as(editor, "select public.merge_events($1, $1)", [s]), /into itself/);
    await db.as(editor, "select public.merge_events($1, $2, 'Same event')", [s, t]);

    const [src] = await db.admin<{ status: string; merged_into: string }>("select status, merged_into from public.historical_events where id = $1", [s]);
    expect(src).toEqual({ status: "archived", merged_into: t });
    expect((await db.admin("select surah, ayah_from, ayah_to from public.event_verse_refs where event_id = $1 order by ayah_from", [t])).length).toBe(2); // the duplicate 12:4-5 is not repeated
    expect(await db.admin("select 1 from public.event_verse_refs where event_id = $1", [s])).toHaveLength(0);
    expect(await db.admin("select 1 from public.event_claims where event_id = $1 and claim_id = $2", [t, claimS])).toHaveLength(1);
    expect(await db.admin("select 1 from public.event_identifications where event_id = $1", [t])).toHaveLength(1);
    // The claims themselves are untouched.
    expect((await db.admin<{ status: string }>("select status from public.evidence_claims where id = $1", [claimS]))[0]!.status).toBe("approved");
    // Connections: the source's moved over (without self-links or repeats), and links that pointed at the source now point at the target.
    const conns = await db.admin<{ event_id: string; target_event_id: string }>("select event_id, target_event_id from public.event_connections where $1 in (event_id, target_event_id)", [t]);
    expect(conns.every((c) => c.event_id !== c.target_event_id)).toBe(true);
    expect(conns.length).toBe(2);
    expect(await db.admin("select 1 from public.event_connections where $1 in (event_id, target_event_id)", [s])).toHaveLength(0);
    // A public note records the merge, and the redirect exists (but is not public while the target is a draft).
    expect((await db.admin<{ n: number }>("select count(*)::int n from public.revision_notes where entity_id = $1 and note like 'Merged with%'", [t]))[0]!.n).toBe(1);
    expect(await db.admin("select event_id from public.event_redirects where old_slug = 'm-source'")).toEqual([{ event_id: t }]);
    expect(await db.as(null, "select 1 from public.event_redirects where old_slug = 'm-source'")).toEqual([]);
    // Merging twice, or merging the archived source again, is refused.
    await rejects(db.as(editor, "select public.merge_events($1, $2)", [s, other]), /already merged|archived/);
  });

  test("a redirect becomes public once its target is published; the archived source never is", async () => {
    const s = await mkEvent("m2-source", { track: "communities" });
    const t = await mkEvent("m2-target", { track: "communities" });
    await db.as(editor, "select public.merge_events($1, $2)", [s, t]);
    await base(t);
    await publish(t);
    expect(await db.as(null, "select old_slug from public.event_redirects where event_id = $1", [t])).toEqual([{ old_slug: "m2-source" }]);
    expect(await db.as(null, "select 1 from public.historical_events where id = $1", [s])).toEqual([]);
  });

  test("a published source needs an admin; a published target must be reopened first; tracks must match", async () => {
    const s = await mkEvent("m3-source", { track: "events" });
    await base(s);
    await publish(s);
    const t = await mkEvent("m3-target", { track: "events" });
    await rejects(db.as(editor, "select public.merge_events($1, $2)", [s, t]), /only an admin merges a published event/);
    const wrongTrack = await mkEvent("m3-wrong", { track: "people" });
    await rejects(db.as(admin, "select public.merge_events($1, $2)", [s, wrongTrack]), /different tracks/);
    await rejects(db.as(admin, "select public.merge_events($1, $2)", [t, s]), /target is published/);
    await db.as(admin, "select public.merge_events($1, $2)", [s, t]);
    expect(await db.as(null, "select 1 from public.historical_events where id = $1", [s])).toEqual([]);
  });
});
