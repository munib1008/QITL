// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";
import { plainRefusal } from "@/lib/people-admin/form";

/**
 * The People and Communities editor screen (/admin/people, /admin/communities) against the real migrations and RLS. No function
 * or table is added for the screen: it uses people, person_aliases, person_claims, historical_communities and the existing
 * review and publish guards. These tests run the statements the routes issue, as an editor, a scholarly reviewer and a reader,
 * and check that the database's refusals map to the plain messages the screen shows. Every text is a labelled placeholder.
 */
const FX = "Fixture";

let db: Db;
let editor: string, scholar: string, alice: string;
let sourceId: string, versionId: string;
const ids: Record<string, string> = {};

async function raw(sql: string, params: unknown[] = []) {
  await db.pg.exec("reset role; set session_replication_role = replica;");
  try {
    return (await db.pg.query<{ id: string }>(sql, params)).rows;
  } finally {
    await db.pg.exec("set session_replication_role = origin;");
  }
}
/** What a route sees when the database says no: { code, message }, mapped as plainRefusal does. */
async function refused(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    const x = e as { code?: string; message?: string; detail?: string };
    return { raw: x, plain: plainRefusal({ code: x.code, message: x.message, details: x.detail }) };
  }
  throw new Error("expected the database to refuse");
}

let n = 0;
const person = async (kind: string, extra: Record<string, unknown> = {}, who = editor) => {
  n += 1;
  const f = { slug: `fixture-pa-${n}`, name_en: `${FX} person ${n}`, name_ar: "شخص", kind, ...extra };
  const cols = Object.keys(f);
  return (await db.as<{ id: string }>(who, `insert into public.people (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f)))[0]!.id;
};
const event = async (slug: string, track: string) =>
  (await raw("insert into public.historical_events (slug, title, track, category, name_source, date_precision, ordering_kind, status) values ($1, $2, $3, 'sacred_history', 'quran', 'unknown', 'unassigned', 'published') returning id", [slug, `${FX} item ${slug}`, track]))[0]!.id;
async function claim(approve: boolean): Promise<string> {
  const [c] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ($1, 'quran', $2) returning id", [`${FX} claim ${Math.random()}`, editor]);
  await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from, quran_ayah_to) values ($1, 'quran', 12, 2, 4)", [c!.id]);
  if (approve) {
    await db.as(scholar, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [c!.id, scholar]);
    await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [c!.id]);
  }
  return c!.id;
}

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

describe("the lists the screen reads", () => {
  test("staff read drafts with claim counts and the linked item; a reader and a visitor see none", async () => {
    const item = await event("fixture-pa-item-people", "people");
    const p = await person("other", { encyclopedia_kind: "ruler", subject_event_id: item });
    await db.as(editor, "insert into public.person_claims (person_id, claim_id) values ($1, $2)", [p, await claim(true)]);
    await db.as(editor, "insert into public.person_claims (person_id, claim_id) values ($1, $2)", [p, await claim(false)]);
    const sql = `select p.id, p.slug, p.kind, p.encyclopedia_kind, p.status, e.title, e.track,
                   (select count(*) from public.person_claims c where c.person_id = p.id)::int as claims
                 from public.people p left join public.historical_events e on e.id = p.subject_event_id where p.id = $1`;
    for (const who of [editor, scholar]) {
      const [row] = await db.as<{ claims: number; track: string; status: string; encyclopedia_kind: string }>(who, sql, [p]);
      expect(row).toMatchObject({ claims: 2, track: "people", status: "draft", encyclopedia_kind: "ruler" });
    }
    expect(await db.as(alice, "select 1 from public.people where id = $1", [p])).toHaveLength(0);
    expect(await db.as(null, "select 1 from public.person_claims where person_id = $1", [p])).toHaveLength(0);
  });
  test("claims come with their Quran references", async () => {
    const rows = await db.as<{ quran_surah: number; quran_ayah_from: number; quran_ayah_to: number }>(
      editor,
      "select r.quran_surah, r.quran_ayah_from, r.quran_ayah_to from public.claim_references r where r.claim_id = $1 and r.kind = 'quran'",
      [await claim(false)],
    );
    expect(rows).toEqual([{ quran_surah: 12, quran_ayah_from: 2, quran_ayah_to: 4 }]);
  });
  test("a community row has the columns the list shows", async () => {
    const [c] = await db.admin<{ id: string }>("insert into public.historical_communities (slug, name_en, evidence_category) values ('fixture-pa-community', 'Fixture community', 'A') returning id");
    ids.community = c!.id;
    const [row] = await db.as<{ status: string; evidence_category: string; claim_id: string | null; subject_event_id: string | null }>(editor, "select status, evidence_category, claim_id, subject_event_id from public.historical_communities where id = $1", [c!.id]);
    expect(row).toEqual({ status: "draft", evidence_category: "A", claim_id: null, subject_event_id: null });
  });
});

describe("editing the group and the Event Universe item", () => {
  test("an editor sets and clears them; refusals read in plain words", async () => {
    const other = await person("other");
    const prophet = await person("prophet");
    const label = await refused(db.as(editor, "update public.people set encyclopedia_kind = 'prophet' where id = $1", [other]));
    expect(label.plain).toMatchObject({ status: 422, code: "prophet_label" });
    expect(label.plain?.message).toMatch(/Only a person whose kind is prophet/);
    const group = await refused(db.as(editor, "update public.people set encyclopedia_kind = 'ruler' where id = $1", [prophet]));
    expect(group.plain).toMatchObject({ code: "prophet_group" });
    await db.as(editor, "update public.people set encyclopedia_kind = 'family_member' where id = $1", [other]);
    await db.as(editor, "update public.people set encyclopedia_kind = null where id = $1", [other]);

    const prophetsItem = await event("fixture-pa-item-prophets", "prophets");
    const wrongTrack = await refused(db.as(editor, "update public.people set subject_event_id = $2 where id = $1", [other, prophetsItem]));
    expect(wrongTrack.plain).toMatchObject({ status: 422, code: "rule" });
    expect(wrongTrack.plain?.message).toMatch(/on the people track/);
    await db.as(editor, "update public.people set subject_event_id = $2 where id = $1", [prophet, prophetsItem]);
    const taken = await refused(db.as(editor, "update public.people set subject_event_id = $2 where id = $1", [await person("prophet"), prophetsItem]));
    expect(taken.plain).toMatchObject({ status: 409, code: "subject_taken" });
    await db.as(editor, "update public.people set subject_event_id = null where id = $1", [prophet]);
  });
  test("a community's item must be on the communities track; one item serves one community", async () => {
    const people = await event("fixture-pa-item-wrong", "people");
    const comm = await event("fixture-pa-item-comm", "communities");
    expect((await refused(db.as(editor, "update public.historical_communities set subject_event_id = $2 where id = $1", [ids.community, people]))).plain?.message).toMatch(/communities track/);
    await db.as(editor, "update public.historical_communities set subject_event_id = $2 where id = $1", [ids.community, comm]);
    const [c2] = await db.admin<{ id: string }>("insert into public.historical_communities (slug, name_en, evidence_category) values ('fixture-pa-community-2', 'Fixture community two', 'A') returning id");
    expect((await refused(db.as(editor, "update public.historical_communities set subject_event_id = $2 where id = $1", [c2!.id, comm]))).plain).toMatchObject({ code: "subject_taken" });
  });
  test("a reader cannot edit; a scholarly reviewer has no write access to links", async () => {
    const p = await person("other");
    expect(await db.as(alice, "update public.people set encyclopedia_kind = 'ruler' where id = $1 returning id", [p])).toHaveLength(0);
    await rejects(db.as(scholar, "insert into public.person_aliases (person_id, alias, language) values ($1, 'x', 'en')", [p]), /row-level security/);
  });
});

describe("aliases", () => {
  test("an editor adds and removes; a duplicate reads in plain words", async () => {
    const p = await person("other");
    await db.as(editor, "insert into public.person_aliases (person_id, alias, language) values ($1, 'Fixture alias', 'en')", [p]);
    await db.as(editor, "insert into public.person_aliases (person_id, alias, language) values ($1, 'اسم', 'ar')", [p]);
    expect((await refused(db.as(editor, "insert into public.person_aliases (person_id, alias, language) values ($1, 'Fixture alias', 'ur')", [p]))).plain).toMatchObject({ status: 409, code: "alias_taken" });
    await db.as(editor, "delete from public.person_aliases where person_id = $1 and alias = 'Fixture alias'", [p]);
    expect(await db.as(editor, "select alias, language from public.person_aliases where person_id = $1", [p])).toEqual([{ alias: "اسم", language: "ar" }]);
  });
  test("the database freezes the aliases of a published person (migration 20261031002630)", async () => {
    const [pub] = await raw("insert into public.people (slug, name_en, name_ar, kind, status) values ('fixture-pa-published', 'Fixture published', 'x', 'other', 'published') returning id");
    await raw("insert into public.person_aliases (person_id, alias, language) values ($1, 'seeded alias', 'en')", [pub!.id]);
    const frozen = /aliases of a published person cannot change/;
    await rejects(db.as(editor, "insert into public.person_aliases (person_id, alias, language) values ($1, 'late alias', 'en')", [pub!.id]), frozen);
    await rejects(db.as(editor, "update public.person_aliases set language = 'ur' where person_id = $1", [pub!.id]), frozen);
    await rejects(db.as(editor, "delete from public.person_aliases where person_id = $1", [pub!.id]), frozen);
    expect(await db.as(editor, "select alias from public.person_aliases where person_id = $1", [pub!.id])).toEqual([{ alias: "seeded alias" }]);
    // After the person is moved to correction the aliases can change again.
    await raw("update public.people set status = 'correction' where id = $1", [pub!.id]);
    await db.as(editor, "insert into public.person_aliases (person_id, alias, language) values ($1, 'late alias', 'en')", [pub!.id]);
    await db.as(editor, "delete from public.person_aliases where person_id = $1", [pub!.id]);
  });
});

describe("claims of a person", () => {
  test("attach, refuse a duplicate, detach; publishing names its reasons whole", async () => {
    const p = await person("historical", { encyclopedia_kind: "ruler" });
    const set = (status: string) => db.as(editor, "update public.people set status = $2 where id = $1", [p, status]);
    expect((await refused(set("published"))).plain?.message).toMatch(/^no review, no publish/);
    await db.as(scholar, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('person', $1, $2, 'approved')", [p, scholar]);
    expect((await refused(set("published"))).plain?.message).toMatch(/^no evidence, no publish: person .* has no evidence claim/);

    const draft = await claim(false);
    const [link] = await db.as<{ id: string }>(editor, "insert into public.person_claims (person_id, claim_id) values ($1, $2) returning id", [p, draft]);
    expect((await refused(db.as(editor, "insert into public.person_claims (person_id, claim_id) values ($1, $2)", [p, draft]))).plain).toMatchObject({ status: 409, code: "claim_taken" });
    expect((await refused(set("published"))).plain?.message).toMatch(/^no evidence, no publish: person .* has an unapproved claim/);
    await db.as(editor, "delete from public.person_claims where id = $1", [link!.id]);
    await db.as(editor, "insert into public.person_claims (person_id, claim_id) values ($1, $2)", [p, await claim(true)]);
    await set("published");
    ids.published = p;
  });
  test("a published person is read-only; a correction opens it again", async () => {
    expect((await refused(db.as(editor, "update public.people set encyclopedia_kind = 'unnamed' where id = $1", [ids.published]))).plain?.message).toMatch(/are fixed: move it to correction first/);
    expect((await refused(db.as(editor, "insert into public.person_claims (person_id, claim_id) values ($1, $2)", [ids.published, await claim(true)]))).plain?.message).toMatch(/move the person to correction first/);
    await db.as(editor, "update public.people set status = 'correction' where id = $1", [ids.published]);
    await db.as(editor, "update public.people set encyclopedia_kind = 'unnamed' where id = $1", [ids.published]);
    await db.as(editor, "insert into public.person_claims (person_id, claim_id) values ($1, $2)", [ids.published, await claim(true)]);
    await db.as(editor, "insert into public.revision_notes (entity_type, entity_id, note, is_correction, public, created_by) values ('person', $1, 'Fixture note', true, true, $2)", [ids.published, editor]);
  });
  test("a claim can be attached only if it exists, and removing the link keeps the claim", async () => {
    const p = await person("other");
    await rejects(db.as(editor, "insert into public.person_claims (person_id, claim_id) values ($1, gen_random_uuid())", [p]), /foreign key|violates/);
    const c = await claim(false);
    const [link] = await db.as<{ id: string }>(editor, "insert into public.person_claims (person_id, claim_id) values ($1, $2) returning id", [p, c]);
    await db.as(editor, "delete from public.person_claims where id = $1", [link!.id]);
    expect(await db.as(editor, "select 1 from public.evidence_claims where id = $1", [c])).toHaveLength(1);
  });
  test("every change is audited", async () => {
    const rows = await db.admin<{ n: number }>("select count(*)::int as n from public.audit_logs where entity_type in ('people', 'person_claims')");
    expect(rows[0]!.n).toBeGreaterThan(0);
  });
});

describe("a published community", () => {
  test("its Event Universe item cannot be changed in place", async () => {
    const comm = await event("fixture-pa-item-comm-2", "communities");
    const [c] = await raw("insert into public.historical_communities (slug, name_en, evidence_category, status) values ('fixture-pa-community-pub', 'Fixture published community', 'A', 'published') returning id");
    expect((await refused(db.as(editor, "update public.historical_communities set subject_event_id = $2 where id = $1", [c!.id, comm]))).plain?.message).toMatch(/cannot be edited in place; move it to correction first/);
  });
});

describe("person_aliases: audit trail and freeze (migration 20261031002630)", () => {
  test("every alias insert, update and delete is audited", async () => {
    const p = await person("other");
    const before = (await db.admin<{ n: number }>("select count(*)::int n from public.audit_logs where entity_type = 'person_aliases'"))[0]!.n;
    await db.as(editor, "insert into public.person_aliases (person_id, alias, language) values ($1, 'Fixture audited alias', 'en')", [p]);
    await db.as(editor, "update public.person_aliases set alias = 'Fixture renamed alias' where person_id = $1", [p]);
    await db.as(editor, "delete from public.person_aliases where person_id = $1", [p]);
    const rows = await db.admin<{ action: string; changes: string }>("select action, changes::text from public.audit_logs where entity_type = 'person_aliases' order by id");
    expect(rows.length - before).toBe(3);
    expect(rows.slice(before).map((r) => r.action)).toEqual(["insert", "update", "delete"]);
    expect(rows[before]!.changes).toContain("Fixture audited alias");
    expect(rows[before + 1]!.changes).toContain("Fixture renamed alias");
  });
  test("an alias cannot be moved to or from a published person", async () => {
    const draft = await person("other");
    const [pub] = await raw("insert into public.people (slug, name_en, name_ar, kind, status) values ('fixture-pa-published-2', 'Fixture published two', 'x', 'other', 'published') returning id");
    await db.as(editor, "insert into public.person_aliases (person_id, alias, language) values ($1, 'Fixture mover', 'en')", [draft]);
    await rejects(db.as(editor, "update public.person_aliases set person_id = $2 where person_id = $1", [draft, pub!.id]), /aliases of a published person cannot change/);
    expect((await refused(db.as(editor, "insert into public.person_aliases (person_id, alias, language) values ($1, 'x2', 'en')", [pub!.id]))).plain?.message).toMatch(/move the person to correction first/);
  });
  test("the search index still carries the aliases of a person when it is published", async () => {
    const p = await person("other");
    await db.as(editor, "insert into public.person_aliases (person_id, alias, language) values ($1, 'Fixturealiasneedle', 'en')", [p]);
    expect(await db.admin("select 1 from public.search_index where entity_type = 'person' and entity_id = $1", [p])).toHaveLength(0);
    await db.as(scholar, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('person', $1, $2, 'approved')", [p, scholar]);
    await db.as(editor, "update public.people set status = 'published' where id = $1", [p]);
    const idx = await db.admin<{ body: string }>("select body from public.search_index where entity_type = 'person' and entity_id = $1", [p]);
    expect(idx[0]?.body ?? "").toContain("Fixturealiasneedle");
  });
});
