// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Hadith Stories (migration 20261031002520): the evidence rule (Bukhari, Muslim, or an individually graded sahih
 * Tirmidhi / Ibn Majah narration), variants kept separate, no copying of narration text, the version-bound scholarly review,
 * no self-review, frozen published rows and RLS. Every text below is a labelled test placeholder, never a hadith.
 */
const FIXTURE = "[TEST FIXTURE — placeholder, not Quran or hadith text]";
const SUMMARY = "Placeholder summary written for tests only.";

let db: Db;
let editor: string, editor2: string, scholar: string, both: string, alice: string, admin: string;
let sourceId: string;
let hb1: string, hb2: string, hm: string, ht_sahih: string, ht_hasan: string, ht_none: string, hd: string, hb_draft: string, hm_trans: string;
let gSahih: string, gHasan: string, gLiGhayrihi: string, gOnBukhari: string;
let quranClaim: string, hadithClaim: string, draftClaim: string;

async function claim(evidence: "quran" | "hadith", approve: boolean, withRef = true): Promise<string> {
  const [c] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ($1, $2, $3) returning id", [`Fixture claim ${Math.random()}`, evidence, editor]);
  if (withRef && evidence === "quran") await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 12, 3)", [c!.id]);
  if (withRef && evidence === "hadith") await db.as(editor, "insert into public.claim_references (claim_id, kind, hadith_id, hadith_grading_id) values ($1, 'hadith', $2, $3)", [c!.id, hb1, gOnBukhari]);
  if (approve) {
    await db.as(scholar, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [c!.id, scholar]);
    await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [c!.id]);
  }
  return c!.id;
}

let n = 0;
async function story(kind = "independent_lesson", who = editor, extra: Record<string, unknown> = {}): Promise<string> {
  n += 1;
  const f = { slug: `fixture-story-${n}`, title_en: "Fixture story", narrator_en: "Fixture narrator", kind, summary_en: SUMMARY, ...extra };
  const cols = Object.keys(f);
  const [r] = await db.as<{ id: string }>(who, `insert into public.hadith_stories (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f));
  return r!.id;
}
const entry = (sid: string, hid: string, o: { primary?: boolean; grading?: string | null } = {}, who = editor) =>
  db.as<{ id: string }>(who, "insert into public.hadith_story_entries (story_id, hadith_id, grading_id, is_primary) values ($1, $2, $3, $4) returning id", [sid, hid, o.grading ?? null, o.primary ?? true]);
const review = (who: string, sid: string, decision = "approved") =>
  db.as(who, "insert into public.hadith_story_reviews (story_id, reviewer_id, decision) values ($1, $2, $3)", [sid, who, decision]);
const publish = (sid: string, who = editor) => db.as(who, "update public.hadith_stories set status = 'published' where id = $1", [sid]);

/** A story that satisfies every rule, ready for its review. */
async function ready(kind = "independent_lesson"): Promise<string> {
  const sid = await story(kind);
  await entry(sid, hb1);
  if (kind === "clarifies_quranic_story") await db.as(editor, "insert into public.hadith_story_claims (story_id, claim_id) values ($1, $2)", [sid, quranClaim]);
  return sid;
}

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("editor@test.local", ["editor"]);
  editor2 = await db.createUser("editor2@test.local", ["editor"]);
  scholar = await db.createUser("scholar@test.local", ["scholarly_reviewer"]);
  both = await db.createUser("both@test.local", ["editor", "scholarly_reviewer"]);
  alice = await db.createUser("alice@test.local");
  admin = await db.createUser("admin@test.local", ["admin"]);
  sourceId = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id"))[0]!.id;
  const versionId = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [sourceId],
  ))[0]!.id;
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (12, 'x', 'Fixture', 111, $1)", [versionId]);
  for (let a = 1; a <= 5; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (12, $1, $2, $3)", [a, FIXTURE, versionId]);
  const hadith = async (collection: string, num: string, status = "published", arabic = `${FIXTURE} ${collection} ${num} sample narration words`) =>
    (await db.admin<{ id: string }>("insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic, status) values ($1, 'fixture', $2, $3, $4, $5) returning id", [collection, num, versionId, arabic, status]))[0]!.id;
  const grading = async (hid: string, grade: string) =>
    (await db.admin<{ id: string }>("insert into public.hadith_gradings (hadith_id, grader, grade, grade_label, source_id, citation) values ($1, 'Fixture grader', $2, $2, $3, 'fixture') returning id", [hid, grade, sourceId]))[0]!.id;
  hb1 = await hadith("bukhari", "1");
  hb2 = await hadith("bukhari", "2");
  hm = await hadith("muslim", "1");
  ht_sahih = await hadith("tirmidhi", "1");
  ht_hasan = await hadith("tirmidhi", "2");
  ht_none = await hadith("tirmidhi", "3");
  hd = await hadith("abudawud", "1");
  hb_draft = await hadith("bukhari", "9", "draft");
  hm_trans = await hadith("muslim", "2", "published", "[fixture] distinct arabic words for the copy check, long enough to matter");
  gOnBukhari = await grading(hb1, "sahih");
  gSahih = await grading(ht_sahih, "sahih");
  gLiGhayrihi = await grading(ht_none, "sahih li-ghayrihi");
  gHasan = await grading(ht_hasan, "hasan");
  await db.admin("insert into public.hadith_translations (hadith_id, source_id, source_version_id, translator, language, text) values ($1, $2, $3, 'Fixture', 'en', 'A fixture translation sentence that is long enough to be detected when copied.')", [hm_trans, sourceId, versionId]);
  quranClaim = await claim("quran", true);
  hadithClaim = await claim("hadith", true);
  draftClaim = await claim("quran", false);
}, 300_000);

describe("structure and registration", () => {
  test("nothing is seeded: no story, no part, no review", async () => {
    for (const t of ["hadith_stories", "hadith_story_entries", "hadith_story_links", "hadith_story_claims", "hadith_story_lessons", "hadith_story_reviews"])
      expect(await db.admin(`select 1 from public.${t}`), t).toHaveLength(0);
  });
  test("the entity type and every author column are registered for the self-review sweep", async () => {
    expect(await db.admin("select 1 from public.review_entity_types where type = 'hadith_story'")).toHaveLength(1);
    const reg = await db.admin<{ table_name: string }>("select table_name from public.review_entity_authors where entity_type = 'hadith_story' order by 1");
    expect(reg.map((r) => r.table_name)).toEqual(["hadith_stories", "hadith_story_claims", "hadith_story_entries", "hadith_story_lessons", "hadith_story_links"]);
    const stamped = await db.admin<{ c: string }>("select c.relname c from pg_trigger t join pg_class c on c.oid = t.tgrelid where t.tgname = 'a0_stamp_author' and c.relname like 'hadith_stor%' order by 1");
    expect(stamped.map((r) => r.c)).toEqual(["hadith_stories", "hadith_story_claims", "hadith_story_entries", "hadith_story_lessons", "hadith_story_links"]);
  });
  test("the author column is stamped by the database", async () => {
    const sid = await story("independent_lesson", editor, { created_by: editor2 });
    expect((await db.admin<{ created_by: string }>("select created_by from public.hadith_stories where id = $1", [sid]))[0]!.created_by).toBe(editor);
  });
});

describe("evidence rule: no evidence, no publish", () => {
  test("a story with no narration is refused", async () => {
    const sid = await story();
    await review(scholar, sid);
    await rejects(publish(sid), /no evidence, no publish/);
  });
  test("Bukhari and Muslim need no per-story grading; a narration must be published", async () => {
    const sid = await story();
    await entry(sid, hm);
    await review(scholar, sid);
    await publish(sid);
    const draftH = await story();
    await entry(draftH, hb_draft);
    await review(scholar, draftH);
    await rejects(publish(draftH), /is not published/);
  });
  test("Tirmidhi needs an individual grading of sahih or sahih li-ghayrihi by a named grader", async () => {
    const none = await story();
    await entry(none, ht_sahih);
    await review(scholar, none);
    await rejects(publish(none), /individual grading/);
    const hasan = await story();
    await entry(hasan, ht_hasan, { grading: gHasan });
    await review(scholar, hasan);
    await rejects(publish(hasan), /individual grading/);
    const ok = await story();
    await entry(ok, ht_sahih, { grading: gSahih });
    await review(scholar, ok);
    await publish(ok);
    const liGhayrihi = await story();
    await entry(liGhayrihi, ht_none, { grading: gLiGhayrihi });
    await review(scholar, liGhayrihi);
    await publish(liGhayrihi);
  });
  test("a collection other than the four is refused, and a grading must belong to its narration", async () => {
    const sid = await story();
    await entry(sid, hd);
    await review(scholar, sid);
    await rejects(publish(sid), /rests only on Sahih al-Bukhari/);
    const s2 = await story();
    await rejects(entry(s2, ht_sahih, { grading: gHasan }), /does not belong/);
  });
  test("exactly one primary narration; variants are separate rows, never merged", async () => {
    const sid = await story();
    await entry(sid, hb1, { primary: true });
    await rejects(entry(sid, hb2, { primary: true }), /duplicate key|unique/);
    await entry(sid, hb2, { primary: false });
    await rejects(entry(sid, hb2, { primary: false }), /duplicate key|unique/);
    expect(await db.admin("select 1 from public.hadith_story_entries where story_id = $1", [sid])).toHaveLength(2);
    const noPrimary = await story();
    await entry(noPrimary, hb1, { primary: false });
    await review(scholar, noPrimary);
    await rejects(publish(noPrimary), /exactly one primary/);
    await review(scholar, sid);
    await publish(sid);
  });
  test("a story that clarifies a Quranic story needs a Quran connection from an approved claim with a Quran reference", async () => {
    const sid = await story("clarifies_quranic_story");
    await entry(sid, hb1);
    await review(scholar, sid);
    await rejects(publish(sid), /needs a Quran connection/);
    await db.as(editor, "insert into public.hadith_story_claims (story_id, claim_id) values ($1, $2)", [sid, draftClaim]);
    await review(scholar, sid);
    await rejects(publish(sid), /not approved/);
    await db.as(editor, "delete from public.hadith_story_claims where story_id = $1", [sid]);
    await db.as(editor, "insert into public.hadith_story_claims (story_id, claim_id) values ($1, $2)", [sid, hadithClaim]);
    await review(scholar, sid);
    await rejects(publish(sid), /Quran reference/);
    await db.as(editor, "delete from public.hadith_story_claims where story_id = $1", [sid]);
    await db.as(editor, "insert into public.hadith_story_claims (story_id, claim_id) values ($1, $2)", [sid, quranClaim]);
    await review(scholar, sid);
    await publish(sid);
  });
  test("the narrator and an English summary are required", async () => {
    const a = await story("independent_lesson", editor, { narrator_en: null });
    await entry(a, hb1);
    await review(scholar, a);
    await rejects(publish(a), /names its narrator/);
    const b = await story("independent_lesson", editor, { summary_en: null });
    await entry(b, hb1);
    await review(scholar, b);
    await rejects(publish(b), /English summary/);
  });
  test("a story links to the narration; copying its Arabic or licensed translation is refused", async () => {
    const arabic = await story("independent_lesson", editor, { summary_ar: "[fixture] distinct arabic words for the copy check, long enough to matter" });
    await entry(arabic, hm_trans);
    await review(scholar, arabic);
    await rejects(publish(arabic), /does not copy its text/);
    const trans = await story("independent_lesson", editor, { summary_en: "Intro. A fixture translation sentence that is long enough to be detected when copied. Outro." });
    await entry(trans, hm_trans);
    await review(scholar, trans);
    await rejects(publish(trans), /does not copy its text/);
  });
});

describe("review: scholarly, bound to the version, never self-review", () => {
  test("no review, no publish; changes requested and rejection do not publish", async () => {
    const sid = await ready();
    await rejects(publish(sid), /no review, no publish/);
    await review(scholar, sid, "changes_requested");
    await rejects(publish(sid), /no review, no publish/);
    await review(scholar, sid, "approved");
    await publish(sid);
  });
  test("only a scholarly reviewer reviews; an editor does not", async () => {
    const sid = await ready();
    await rejects(review(editor2, sid), /row-level security|only a scholarly reviewer/);
    await rejects(review(alice, sid), /row-level security|only a scholarly reviewer/);
  });
  test("an approval is bound to the version: editing the draft afterwards makes it stale", async () => {
    const sid = await ready();
    await review(scholar, sid);
    const [{ version }] = await db.admin<{ version: number }>("select version from public.hadith_stories where id = $1", [sid]) as [{ version: number }];
    await db.as(editor, "update public.hadith_stories set title_en = 'Fixture story, edited' where id = $1", [sid]);
    expect((await db.admin<{ version: number }>("select version from public.hadith_stories where id = $1", [sid]))[0]!.version).toBe(version + 1);
    await rejects(publish(sid), /no review, no publish/);
    await review(scholar, sid);
    await publish(sid);
  });
  test("changing a part of a draft also makes a new version", async () => {
    const sid = await ready();
    await review(scholar, sid);
    await db.as(editor, "insert into public.hadith_story_lessons (story_id, kind, body_en) values ($1, 'lesson', 'A placeholder lesson written for tests.')", [sid]);
    await rejects(publish(sid), /no review, no publish/);
  });
  test("the author of the story, or of any part, cannot review it", async () => {
    const sid = await story("independent_lesson", both);
    await entry(sid, hb1, {}, both);
    await rejects(review(both, sid), /cannot review their own/);
    const sid2 = await story("independent_lesson", editor);
    await entry(sid2, hb1, {}, both);
    await rejects(review(both, sid2), /cannot review their own/);
    await review(scholar, sid2);
  });
});

describe("published stories are frozen", () => {
  test("neither the story nor its parts can change until it is moved to correction", async () => {
    const sid = await ready();
    await review(scholar, sid);
    await publish(sid);
    await rejects(db.as(editor, "update public.hadith_stories set title_en = 'Changed' where id = $1", [sid]), /cannot be edited in place/);
    await rejects(db.as(editor, "insert into public.hadith_story_lessons (story_id, kind, body_en) values ($1, 'lesson', 'A placeholder lesson written for tests.')", [sid]), /cannot change/);
    await rejects(db.as(editor, "delete from public.hadith_story_entries where story_id = $1", [sid]), /cannot change/);
    await db.as(editor, "update public.hadith_stories set status = 'correction' where id = $1", [sid]);
    await db.as(editor, "update public.hadith_stories set title_en = 'Corrected' where id = $1", [sid]);
    await rejects(publish(sid), /no review, no publish/);
  });
});

describe("links, lessons and visibility", () => {
  test("links point at a person, community, event or theme by id, never by free text", async () => {
    const sid = await story();
    const [p] = await db.admin<{ id: string }>("insert into public.people (slug, name_en, name_ar, kind) values ('fixture-link-person', 'Fixture person', 'x', 'other') returning id");
    const [c] = await db.admin<{ id: string }>("insert into public.historical_communities (slug, name_en, evidence_category) values ('fixture-link-community', 'Fixture community', 'A') returning id");
    const [e] = await db.admin<{ id: string }>("insert into public.historical_events (slug, title, category, date_precision) values ('fixture-link-event', 'Fixture event', 'sacred_history', 'unknown') returning id");
    const [t] = await db.admin<{ id: string }>("insert into public.guidance_topics (slug, title_en, title_ar) values ('fixture-link-theme', 'Fixture theme', 'x x') returning id");
    for (const [kind, col, id] of [["person", "person_id", p!.id], ["community", "community_id", c!.id], ["event", "event_id", e!.id], ["theme", "guidance_topic_id", t!.id]] as const)
      await db.as(editor, `insert into public.hadith_story_links (story_id, target_kind, ${col}) values ($1, $2, $3)`, [sid, kind, id]);
    await rejects(db.as(editor, "insert into public.hadith_story_links (story_id, target_kind, person_id) values ($1, 'person', $2)", [sid, p!.id]), /duplicate key|unique/);
    await rejects(db.as(editor, "insert into public.hadith_story_links (story_id, target_kind, person_id, event_id) values ($1, 'person', $2, $3)", [sid, p!.id, e!.id]), /violates check/);
    await rejects(db.as(editor, "insert into public.hadith_story_links (story_id, target_kind, event_id) values ($1, 'person', $2)", [sid, e!.id]), /violates check/);
    // the same person can be linked from many stories
    const other = await story();
    await db.as(editor, "insert into public.hadith_story_links (story_id, target_kind, person_id) values ($1, 'person', $2)", [other, p!.id]);
  });
  test("drafts and their parts are invisible to visitors; a published story and its parts are public", async () => {
    const draft = await ready();
    await db.as(editor, "insert into public.hadith_story_lessons (story_id, kind, body_en) values ($1, 'modern_application', 'A placeholder application written for tests.')", [draft]);
    const pub = await ready();
    await db.as(editor, "insert into public.hadith_story_lessons (story_id, kind, body_en) values ($1, 'modern_application', 'A placeholder application written for tests.')", [pub]);
    await review(scholar, pub);
    await publish(pub);
    for (const who of [null, alice]) {
      expect((await db.as<{ id: string }>(who, "select id from public.hadith_stories")).map((r) => r.id)).toContain(pub);
      expect((await db.as<{ id: string }>(who, "select id from public.hadith_stories")).map((r) => r.id)).not.toContain(draft);
      expect((await db.as(who, "select 1 from public.hadith_story_entries where story_id = $1", [draft]))).toHaveLength(0);
      expect((await db.as(who, "select 1 from public.hadith_story_lessons where story_id = $1", [draft]))).toHaveLength(0);
      expect((await db.as(who, "select 1 from public.hadith_story_entries where story_id = $1", [pub]))).toHaveLength(1);
      if (who) expect(await db.as(who, "select 1 from public.hadith_story_reviews")).toHaveLength(0);
      else await rejects(db.as(who, "select 1 from public.hadith_story_reviews"), /permission denied/);
    }
    expect((await db.as(editor, "select 1 from public.hadith_story_entries where story_id = $1", [draft]))).toHaveLength(1);
    await rejects(db.as(alice, "insert into public.hadith_stories (slug, title_en, kind) values ('fixture-x', 'x y', 'separate_episode')"), /row-level security|permission denied/);
    await rejects(db.as(editor, "insert into public.hadith_stories (slug, title_en, kind, status) values ('fixture-y', 'x y', 'separate_episode', 'published')"), /row-level security|names its narrator/);
  });
  test("public counts follow the stories and carry no titles", async () => {
    const [c] = await db.as<{ published: number; under_review: number }>(null, "select published, under_review from public.encyclopedia_stats where kind = 'hadith_story'");
    const [real] = await db.admin<{ p: number; u: number }>(
      "select count(*) filter (where status = 'published')::int p, count(*) filter (where status in ('draft','in_review','approved','correction'))::int u from public.hadith_stories",
    );
    expect(Number(c!.published)).toBe(real!.p);
    expect(Number(c!.under_review)).toBe(real!.u);
    expect(real!.p).toBeGreaterThan(0);
    expect(admin).toBeTruthy();
  });
});
