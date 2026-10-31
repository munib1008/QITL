// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * People and communities encyclopedia (migration 20261031002521) and unified story search (20261031002522): kinds from data,
 * a non-prophet never filed as a prophet, evidence before publishing, frozen published rows, typed and faceted search over
 * published records only. Every text below is a labelled test placeholder, never religious content.
 */
const FX = "Fixture";

let db: Db;
let editor: string, scholar: string, alice: string;
let sourceId: string, versionId: string;
const ids: Record<string, string> = {};

/** Insert rows bypassing the editorial publish guards (setup only), then rebuild the index. */
async function raw(sql: string, params: unknown[] = []) {
  await db.pg.exec("reset role; set session_replication_role = replica;");
  try {
    return (await db.pg.query<{ id: string }>(sql, params)).rows;
  } finally {
    await db.pg.exec("set session_replication_role = origin;");
  }
}

async function approvedClaim(quran: boolean): Promise<string> {
  const [c] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ($1, $2, $3) returning id", [`Fixture claim ${Math.random()}`, quran ? "quran" : "scholar", editor]);
  if (quran) await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 12, 3)", [c!.id]);
  else await db.as(editor, "insert into public.claim_references (claim_id, kind, source_id, locator) values ($1, 'scholar', $2, 'p. 1')", [c!.id, sourceId]);
  await db.as(scholar, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [c!.id, scholar]);
  await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [c!.id]);
  return c!.id;
}

let n = 0;
const person = (kind: string, extra: Record<string, unknown> = {}, who = editor) => {
  n += 1;
  const f = { slug: `fixture-person-${n}`, name_en: `${FX} person ${n}`, name_ar: "شخص", kind, ...extra };
  const cols = Object.keys(f);
  return db.as<{ id: string }>(who, `insert into public.people (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f));
};
const event = async (slug: string, track: string) =>
  (await raw("insert into public.historical_events (slug, title, track, category, name_source, date_precision, ordering_kind, status) values ($1, $2, $3, 'sacred_history', 'quran', 'unknown', 'unassigned', 'published') returning id", [slug, `${FX} item ${slug}`, track]))[0]!.id;

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("editor@test.local", ["editor"]);
  scholar = await db.createUser("scholar@test.local", ["scholarly_reviewer"]);
  alice = await db.createUser("alice@test.local");
  sourceId = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status, source_url) values ('hadith_collection', 'Fixture source', 'cleared', 'https://example.test') returning id"))[0]!.id;
  versionId = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('b', 64), now(), 'https://example.test', true) returning id",
    [sourceId],
  ))[0]!.id;
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (12, 'x', 'Fixture', 111, $1)", [versionId]);
  for (let a = 1; a <= 5; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (12, $1, 'placeholder', $2)", [a, versionId]);
}, 300_000);

describe("people: kind comes from data and a non-prophet is never a prophet", () => {
  test("encyclopedia_kind 'prophet' only for kind = prophet, and a prophet is never filed elsewhere", async () => {
    await rejects(person("companion", { encyclopedia_kind: "prophet" }), /people_prophet_label|violates check/);
    await rejects(person("prophet", { encyclopedia_kind: "ruler" }), /people_prophet_group|violates check/);
    await rejects(person("other", { encyclopedia_kind: "king" }), /people_encyclopedia_kind_check|violates check/);
    await person("prophet", { encyclopedia_kind: "prophet" });
    await person("historical", { encyclopedia_kind: "ruler" });
    await person("other", { encyclopedia_kind: "unnamed" });
    await person("other");
  });
  test("the Event Universe item of a person is on the matching track", async () => {
    const prophetsItem = await event("fixture-item-prophets", "prophets");
    const peopleItem = await event("fixture-item-people", "people");
    const [prophet] = await person("prophet");
    const [other] = await person("other");
    await rejects(db.as(editor, "update public.people set subject_event_id = $2 where id = $1", [other!.id, prophetsItem]), /never filed under the prophets/);
    await rejects(db.as(editor, "update public.people set subject_event_id = $2 where id = $1", [prophet!.id, peopleItem]), /on the prophets track/);
    await db.as(editor, "update public.people set subject_event_id = $2 where id = $1", [other!.id, peopleItem]);
    await db.as(editor, "update public.people set subject_event_id = $2 where id = $1", [prophet!.id, prophetsItem]);
    ids.prophetsItem = prophetsItem;
    ids.peopleItem = peopleItem;
  });
});

describe("publishing a person", () => {
  test("a person who joins the encyclopedia needs approved claims and the scholarly review; existing people keep the old rule", async () => {
    const [p] = await person("historical", { encyclopedia_kind: "ruler", slug: "fixture-ruler" });
    const pub = (id: string) => db.as(editor, "update public.people set status = 'published' where id = $1", [id]);
    await rejects(pub(p!.id), /no review, no publish/);
    await db.as(scholar, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('person', $1, $2, 'approved')", [p!.id, scholar]);
    await rejects(pub(p!.id), /no evidence claim/);
    const draft = (await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ('Fixture draft claim text', 'scholar', $1) returning id", [editor]))[0]!.id;
    await db.as(editor, "insert into public.person_claims (person_id, claim_id) values ($1, $2)", [p!.id, draft]);
    await rejects(pub(p!.id), /unapproved claim/);
    await db.as(editor, "delete from public.person_claims where person_id = $1", [p!.id]);
    await db.as(editor, "insert into public.person_claims (person_id, claim_id) values ($1, $2)", [p!.id, await approvedClaim(true)]);
    await pub(p!.id);
    ids.ruler = p!.id;
    // A legacy person (no encyclopedia fields) needs only the review, as before.
    const [legacy] = await person("other", { slug: "fixture-legacy" });
    await db.as(scholar, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('person', $1, $2, 'approved')", [legacy!.id, scholar]);
    await pub(legacy!.id);
  });
  test("a published person's kind and claims are fixed until correction", async () => {
    await rejects(db.as(editor, "update public.people set encyclopedia_kind = 'family_member' where id = $1", [ids.ruler]), /are fixed/);
    await rejects(db.as(editor, "insert into public.person_claims (person_id, claim_id) values ($1, $2)", [ids.ruler, await approvedClaim(false)]), /cannot change/);
  });
  test("claims are public only with a published person; drafts stay hidden", async () => {
    const [d] = await person("other", { slug: "fixture-draft-person" });
    await db.as(editor, "insert into public.person_claims (person_id, claim_id) values ($1, $2)", [d!.id, await approvedClaim(false)]);
    expect(await db.as(null, "select 1 from public.person_claims where person_id = $1", [d!.id])).toHaveLength(0);
    expect(await db.as(alice, "select 1 from public.person_claims where person_id = $1", [d!.id])).toHaveLength(0);
    expect(await db.as(null, "select 1 from public.person_claims where person_id = $1", [ids.ruler])).toHaveLength(1);
    expect(await db.as(editor, "select 1 from public.person_claims where person_id = $1", [d!.id])).toHaveLength(1);
  });
  test("counts are public numbers and follow the records", async () => {
    const rows = await db.as<{ kind: string; published: number; under_review: number }>(null, "select kind, published, under_review from public.encyclopedia_stats order by kind");
    const people = rows.find((r) => r.kind === "person")!;
    const [real] = await db.admin<{ p: number; u: number }>("select count(*) filter (where status = 'published')::int p, count(*) filter (where status in ('draft','in_review','approved','correction'))::int u from public.people");
    expect({ p: Number(people.published), u: Number(people.under_review) }).toEqual(real);
    expect(rows.map((r) => r.kind)).toEqual(["community", "hadith_story", "person"]);
  });
});

describe("communities", () => {
  test("a community's Event Universe item is on the communities track", async () => {
    const community = await event("fixture-item-community", "communities");
    const [c] = await db.admin<{ id: string }>("insert into public.historical_communities (slug, name_en, evidence_category) values ('fixture-community', 'Fixture community', 'A') returning id");
    await rejects(db.as(editor, "update public.historical_communities set subject_event_id = $2 where id = $1", [c!.id, ids.peopleItem]), /communities track/);
    await db.as(editor, "update public.historical_communities set subject_event_id = $2 where id = $1", [c!.id, community]);
    ids.community = c!.id;
  });
});

describe("unified story search: typed, faceted, published only", () => {
  beforeAll(async () => {
    const claim = await approvedClaim(true);
    const searchItem = await event("fixture-item-prophets-search", "prophets");
    const [prophet] = await raw("insert into public.people (slug, name_en, name_ar, kind, encyclopedia_kind, subject_event_id, status) values ('fixture-search-prophet', $1, 'يوسف', 'prophet', 'prophet', $2, 'published') returning id", [`${FX} Yusufa prophet`, searchItem]);
    await raw("insert into public.person_claims (person_id, claim_id) values ($1, $2)", [prophet!.id, claim]);
    await raw("insert into public.person_aliases (person_id, alias, language) values ($1, 'Fixturejoseph', 'en'), ($1, 'یوسفی', 'ur')", [prophet!.id]);
    await raw("insert into public.people (slug, name_en, name_ar, kind, status) values ('fixture-search-draft', $1, 'مسودة', 'other', 'draft')", [`${FX} draftsecret person`]);
    await raw("update public.historical_communities set status = 'published', summary = 'Placeholder community summary' where id = $1", [ids.community]);
    await raw("insert into public.historical_events (slug, title, track, category, name_source, date_precision, ordering_kind, status) values ('fixture-search-parable', $1, 'parables', 'sacred_history', 'quran', 'unknown', 'unassigned', 'published')", [`${FX} parable item`]);
    await raw("insert into public.event_verse_refs (event_id, surah, ayah_from, ayah_to) values ($1, 12, 4, 5), ($2, 12, 1, 2)", [ids.prophetsItem, searchItem]);
    const hadithId = (await raw("insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic, status) values ('bukhari', 'fixture', '7001', $1, $2, 'published') returning id", [versionId, `${FX} hadithtextsecret narration words`]))[0]!.id;
    const [hs] = await raw(
      "insert into public.hadith_stories (slug, title_en, title_ar, title_ur, narrator_en, kind, summary_en, status) values ('fixture-search-hs', $1, 'قصة', 'کہانی', 'Fixture narrator', 'clarifies_quranic_story', 'Placeholder summary', 'published') returning id",
      [`${FX} hadith story title`],
    );
    await raw("insert into public.hadith_story_entries (story_id, hadith_id, is_primary) values ($1, $2, true)", [hs!.id, hadithId]);
    await raw("insert into public.hadith_story_claims (story_id, claim_id) values ($1, $2)", [hs!.id, claim]);
    await raw("insert into public.hadith_stories (slug, title_en, kind, status) values ('fixture-search-hs-draft', $1, 'separate_episode', 'draft')", [`${FX} draftsecret hadith story`]);
    await db.admin("select public.search_reindex()");
  }, 120_000);

  type R = { entity_type: string; entity_id: string; url: string; title: string; kind: string | null; track: string | null; surahs: number[] };
  const search = (q: string, extra = "null, null, null") => db.as<R>(null, `select * from public.search($1, null, 200, 0, null, ${extra})`, [q]);

  test("every result carries a type; each source maps to its type, link and track", async () => {
    const rows = await search(FX);
    const by = (u: string) => rows.find((r) => r.url === u);
    expect(by("/people/fixture-search-prophet")).toMatchObject({ kind: "prophet", track: "prophets" });
    expect(by("/communities/fixture-community")).toMatchObject({ kind: "community", track: "communities" });
    expect(by("/hadith-stories/fixture-search-hs")).toMatchObject({ kind: "hadith_story" });
    expect(by("/events/fixture-search-parable")).toMatchObject({ kind: "parable", track: "parables" });
    expect(by("/events/fixture-item-prophets")).toMatchObject({ kind: "prophet", track: "prophets" });
    expect(by("/events/fixture-item-people")).toMatchObject({ kind: "person", track: "people" });
    expect(by("/people/fixture-ruler")).toMatchObject({ kind: "person" });
    expect(rows.every((r) => r.kind !== undefined)).toBe(true);
  });
  test("drafts never appear and a hadith story never indexes the narration text", async () => {
    const text = JSON.stringify(await search(FX));
    expect(text).not.toMatch(/draftsecret|hadithtextsecret/);
    const [row] = await db.admin<{ body: string }>("select body from public.search_index where entity_type = 'hadith_story'");
    expect(row!.body).not.toMatch(/hadithtextsecret/);
    expect(JSON.stringify(await db.as(alice, "select * from public.search($1, null, 50, 0)", ["draftsecret"]))).toBe("[]");
  });
  test("names are found in English, Arabic and Urdu spellings, and by alias", async () => {
    expect((await search("Yusufa")).map((r) => r.url)).toContain("/people/fixture-search-prophet");
    expect((await search("يُوسُف")).map((r) => r.url)).toContain("/people/fixture-search-prophet");
    expect((await search("Fixturejoseph")).map((r) => r.url)).toContain("/people/fixture-search-prophet");
    expect((await search("یوسفی")).map((r) => r.url)).toContain("/people/fixture-search-prophet");
    // the Urdu title of a hadith story
    expect((await search("کہانی")).map((r) => r.url)).toContain("/hadith-stories/fixture-search-hs");
    expect((await search("قصة")).map((r) => r.url)).toContain("/hadith-stories/fixture-search-hs");
  });
  test("facets: type, track and surah", async () => {
    const kinds = (await search(FX, "array['hadith_story','community'], null, null")).map((r) => r.kind);
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds.every((k) => k === "hadith_story" || k === "community")).toBe(true);
    const tracks = (await search(FX, "null, array['parables'], null")).map((r) => r.track);
    expect(tracks).toEqual(["parables"]);
    const s12 = (await search(FX, "null, null, 12::smallint")).map((r) => r.url);
    expect(s12).toEqual(expect.arrayContaining(["/people/fixture-search-prophet", "/hadith-stories/fixture-search-hs", "/events/fixture-item-prophets"]));
    expect(s12).not.toContain("/events/fixture-search-parable");
    expect((await search(FX, "null, null, 13::smallint"))).toEqual([]);
  });
  test("unpublishing removes the typed row at once", async () => {
    await db.admin("update public.hadith_stories set status = 'draft' where slug = 'fixture-search-hs'");
    expect((await search(FX)).map((r) => r.url)).not.toContain("/hadith-stories/fixture-search-hs");
    expect(await db.admin("select 1 from public.search_index where entity_type = 'hadith_story'")).toHaveLength(0);
  });
});
