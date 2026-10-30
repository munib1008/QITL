// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Integration tests of the real migrations: RLS per role, publish guards, chronology and geometry
 * constraints, moderation and rate limits. Fixture text is a labelled placeholder, never religious text.
 */
const FIXTURE = "[TEST FIXTURE — placeholder, not Quran or hadith text]";

let db: Db;
let alice: string, bob: string, editor: string, reviewer: string, reviewer2: string, moderator: string, admin: string;
let sourceId: string, versionId: string;

beforeAll(async () => {
  db = await createDb();
  alice = await db.createUser("alice@test.local");
  bob = await db.createUser("bob@test.local");
  editor = await db.createUser("editor@test.local", ["editor"]);
  reviewer = await db.createUser("reviewer@test.local", ["scholarly_reviewer"]);
  reviewer2 = await db.createUser("reviewer2@test.local", ["scholarly_reviewer", "editor"]);
  moderator = await db.createUser("mod@test.local", ["moderator"]);
  admin = await db.createUser("admin@test.local", ["admin"]);
  [{ id: sourceId }] = (await db.admin<{ id: string }>(
    "insert into public.sources (type, work, rights_status, source_url) values ('quran_text', 'Test source', 'cleared', 'https://example.test') returning id",
  )) as [{ id: string }];
  [{ id: versionId }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [sourceId],
  )) as [{ id: string }];
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (12, 'x', 'Fixture', 111, $1)", [versionId]);
  for (let a = 1; a <= 5; a++)
    await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (12, $1, $2, $3)", [a, FIXTURE, versionId]);
}, 180_000);

describe("profiles", () => {
  test("a profile and notification prefs are created for every new user", async () => {
    const rows = await db.as(alice, "select id from public.profiles where id = $1", [alice]);
    expect(rows).toHaveLength(1);
    const prefs = await db.as(alice, "select digest from public.notification_prefs");
    expect(prefs).toEqual([{ digest: "weekly" }]);
  });
});

describe("bookmarks", () => {
  test("anonymous visitors cannot write or read bookmarks", async () => {
    await rejects(db.as(null, "insert into public.bookmarks (user_id, target_type, target_id) values ($1, 'journey_stop', 'adam')", [alice]), /permission denied|row-level security/);
    await rejects(db.as(null, "select * from public.bookmarks"), /permission denied/);
  });
  test("a user saves, sees only their own, and duplicates are refused", async () => {
    await db.as(alice, "insert into public.bookmarks (target_type, target_id) values ('journey_stop', 'adam')");
    await rejects(db.as(alice, "insert into public.bookmarks (target_type, target_id) values ('journey_stop', 'adam')"), /duplicate key/);
    await rejects(db.as(bob, "insert into public.bookmarks (user_id, target_type, target_id) values ($1, 'journey_stop', 'nuh')", [alice]), /row-level security/);
    expect(await db.as(bob, "select * from public.bookmarks")).toHaveLength(0);
    expect(await db.as(alice, "select target_id from public.bookmarks")).toEqual([{ target_id: "adam" }]);
  });
});

describe("private notes", () => {
  test("only the owner can read a note; not other users, moderators or admins", async () => {
    await db.as(alice, "insert into public.private_notes (target_type, target_id, body) values ('journey_stop', 'yusuf', 'my private thought')");
    expect(await db.as(alice, "select body from public.private_notes")).toEqual([{ body: "my private thought" }]);
    for (const u of [bob, moderator, admin]) expect(await db.as(u, "select body from public.private_notes")).toHaveLength(0);
    await rejects(db.as(null, "select body from public.private_notes"), /permission denied/);
  });
  test("note bodies never reach the audit log", async () => {
    const rows = await db.admin<{ n: number }>("select count(*)::int n from public.audit_logs where changes::text like '%my private thought%'");
    expect(rows[0]!.n).toBe(0);
  });
});

async function newClaim(by: string, statement = "Fixture claim for testing the publish guard"): Promise<string> {
  const [r] = await db.as<{ id: string }>(by, "insert into public.evidence_claims (statement, evidence, created_by) values ($1, 'quran', $2) returning id", [statement, by]);
  return r!.id;
}

describe("evidence and publishing", () => {
  test("no evidence, no publish", async () => {
    const id = await newClaim(editor);
    await rejects(db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [id]), /no evidence, no publish/);
  });
  test("a reference without a reviewer's approval is not enough", async () => {
    const id = await newClaim(editor);
    await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from, quran_ayah_to) values ($1, 'quran', 12, 1, 3)", [id]);
    await rejects(db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [id]), /no review, no publish/);
  });
  test("a Quran reference must exist in the verified text", async () => {
    const id = await newClaim(editor);
    await rejects(db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 12, 99)", [id]), /foreign key/);
    await rejects(db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from, quran_ayah_to) values ($1, 'quran', 12, 2, 99)", [id]), /outside the surah/);
  });
  test("only a scholarly reviewer may review, and never their own claim", async () => {
    const id = await newClaim(reviewer2);
    await rejects(db.as(editor, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [id, editor]), /row-level security|scholarly reviewer/);
    await rejects(db.as(reviewer2, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [id, reviewer2]), /own claim/);
  });
  test("referenced and approved: the claim can be approved, and its story chapter published", async () => {
    const claim = await newClaim(editor);
    await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from, quran_ayah_to) values ($1, 'quran', 12, 4, 5)", [claim]);
    await db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [claim, reviewer]);
    await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [claim]);

    const [story] = await db.as<{ id: string }>(editor, "insert into public.stories (slug, title, summary) values ('fixture-story', 'Fixture story', 'A test story') returning id");
    const [ch] = await db.as<{ id: string }>(editor, "insert into public.chapters (story_id, position, title) values ($1, 1, 'One') returning id", [story!.id]);
    await rejects(db.as(editor, "update public.chapters set status = 'published' where id = $1", [ch!.id]), /no evidence, no publish/);
    await db.as(editor, "insert into public.chapter_claims (chapter_id, claim_id) values ($1, $2)", [ch!.id, claim]);
    await rejects(db.as(editor, "update public.chapters set status = 'published' where id = $1", [ch!.id]), /no review, no publish/);
    await db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('chapter', $1, $2, 'approved')", [ch!.id, reviewer]);
    await db.as(editor, "update public.chapters set status = 'published' where id = $1", [ch!.id]);
    await db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('story', $1, $2, 'approved')", [story!.id, reviewer]);
    await db.as(editor, "update public.stories set status = 'published' where id = $1", [story!.id]);

    // Public sees it, a version snapshot exists, the search index has it, and the audit trail recorded it.
    expect(await db.as(null, "select slug from public.stories where status = 'published'")).toEqual([{ slug: "fixture-story" }]);
    const v = await db.admin<{ n: number }>("select count(*)::int n from public.content_versions where entity_id = $1", [story!.id]);
    expect(v[0]!.n).toBeGreaterThan(0);
    const s = await db.as<{ url: string }>(null, "select url from public.search('fixture')");
    expect(s.map((r) => r.url)).toContain("/stories/fixture-story");
    const a = await db.admin<{ n: number }>("select count(*)::int n from public.audit_logs where entity_type = 'stories' and entity_id = $1", [story!.id]);
    expect(a[0]!.n).toBeGreaterThan(0);
  });
  test("drafts are invisible to the public and to ordinary users", async () => {
    await db.as(editor, "insert into public.stories (slug, title, summary) values ('draft-story', 'Draft', 'Not yet reviewed')");
    expect(await db.as(null, "select * from public.stories where slug = 'draft-story'")).toHaveLength(0);
    expect(await db.as(alice, "select * from public.stories where slug = 'draft-story'")).toHaveLength(0);
    expect(await db.as(reviewer, "select * from public.stories where slug = 'draft-story'")).toHaveLength(1);
  });
  test("ordinary users cannot write editorial content", async () => {
    await rejects(db.as(alice, "insert into public.stories (slug, title, summary) values ('x', 'x', 'x')"), /row-level security|permission denied/);
    await rejects(db.as(alice, "insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (12, 6, 'x', $1)", [versionId]), /permission denied/);
  });
  test("the Quran Arabic cannot be edited in place", async () => {
    await rejects(db.admin("update public.quran_verses set text_ar = 'altered' where surah_id = 12 and ayah_no = 1"), /immutable/);
  });
});

describe("chronology", () => {
  test("relative-order events carry no years", async () => {
    await rejects(
      db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, relative_order, start_year) values ('e1', 'E1', 'sacred_history', 'relative', 1, -3000)"),
      /check constraint/,
    );
    await db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, relative_order) values ('e2', 'E2', 'sacred_history', 'relative', 1)");
  });
  test("an event with an unknown date is valid and has no years", async () => {
    await db.as(editor, "insert into public.historical_events (slug, title, category, date_precision) values ('e3', 'E3', 'sacred_history', 'unknown')");
  });
  test("the Last Hour never has a date", async () => {
    await rejects(
      db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, start_year, end_year) values ('lh1', 'Sign', 'last_hour_major', 'estimated', 2100, 2200)"),
      /check constraint/,
    );
    await db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, relative_order) values ('lh2', 'Sign', 'last_hour_major', 'relative', 3)");
  });
  test("ranges are ordered and exact dates are single years (astronomical numbering handles 1 BCE = 0)", async () => {
    await rejects(db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, start_year, end_year) values ('r1', 'R', 'islamic_history', 'range', 700, 650)"), /check constraint/);
    await db.as(editor, "insert into public.historical_events (slug, title, category, date_precision, start_year, end_year) values ('r2', 'R', 'islamic_history', 'range', -1, 1)");
  });
});

describe("geometry", () => {
  let loc: string, claim: string;
  beforeAll(async () => {
    [{ id: loc }] = (await db.as<{ id: string }>(editor, "insert into public.locations (slug, name_en, type) values ('fixture-region', 'Fixture region', 'region') returning id")) as [{ id: string }];
    claim = await newClaim(editor);
  });
  test("an unknown place has no geometry, and a geometry is never 'unknown'", async () => {
    await db.as(editor, "insert into public.place_geometries (location_id, precision, confidence) values ($1, 'unknown', 'unknown')", [loc]);
    await rejects(
      db.as(editor, "insert into public.place_geometries (location_id, geom, precision, confidence) values ($1, st_geomfromtext('POINT(39 21)', 4326), 'unknown', 'unknown')", [loc]),
      /check constraint/,
    );
  });
  test("a point needs a claim and a source", async () => {
    await rejects(
      db.as(editor, "insert into public.place_geometries (location_id, geom, precision, confidence) values ($1, st_geomfromtext('POINT(39 21)', 4326), 'point', 'scholar')", [loc]),
      /check constraint/,
    );
  });
  test("an approximate region cannot be a disguised pin", async () => {
    await rejects(
      db.as(editor, "insert into public.place_geometries (location_id, geom, precision, confidence, claim_id, source_id) values ($1, st_geomfromtext('POLYGON((39 21, 39.001 21, 39.001 21.001, 39 21.001, 39 21))', 4326), 'region', 'estimate', $2, $3)", [loc, claim, sourceId]),
      /too small/,
    );
    await db.as(editor, "insert into public.place_geometries (location_id, geom, precision, confidence, claim_id, source_id) values ($1, st_geomfromtext('POLYGON((38 20, 41 20, 41 23, 38 23, 38 20))', 4326), 'region', 'estimate', $2, $3)", [loc, claim, sourceId]);
  });
});

describe("hadith gradings", () => {
  test("the summary keeps every grading and flags disagreement", async () => {
    const [h] = await db.admin<{ id: string }>(
      "insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic, status) values ('tirmidhi', 'fixture', '1', $1, $2, 'published') returning id",
      [versionId, FIXTURE],
    );
    await db.admin("insert into public.hadith_gradings (hadith_id, grader, grade, grade_label, source_id, citation) values ($1, 'Grader A', 'hasan', 'Hasan', $2, 'fixture p.1'), ($1, 'Grader B', 'daif', 'Da''if', $2, 'fixture p.2')", [h!.id, sourceId]);
    const [s] = await db.as<{ grading_count: number; varies: boolean; all_authentic: boolean; gradings: unknown[] }>(null, "select grading_count::int, varies, all_authentic, gradings from public.hadith_grade_summary where hadith_id = $1", [h!.id]);
    expect(s).toMatchObject({ grading_count: 2, varies: true, all_authentic: false });
    expect(s!.gradings).toHaveLength(2);
  });
  test("an ungraded narration is not authentic by default", async () => {
    const [h] = await db.admin<{ id: string }>(
      "insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic, status) values ('bukhari', 'fixture', '2', $1, $2, 'published') returning id",
      [versionId, FIXTURE],
    );
    const [s] = await db.as<{ all_authentic: boolean }>(null, "select all_authentic from public.hadith_grade_summary where hadith_id = $1", [h!.id]);
    expect(s!.all_authentic).toBe(false);
  });
});

describe("translation licensing", () => {
  test("a translation whose licence is not cleared is invisible to readers", async () => {
    const [src] = await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_translation', 'Pending translation', 'requested') returning id");
    await db.admin("insert into public.quran_translations (surah_id, ayah_no, source_id, source_version_id, translator, edition, language, text) values (12, 1, $1, $2, 'T', 'E', 'en', $3)", [src!.id, versionId, FIXTURE]);
    expect(await db.as(null, "select * from public.quran_translations")).toHaveLength(0);
    await db.admin("update public.sources set rights_status = 'cleared' where id = $1", [src!.id]);
    expect(await db.as(null, "select * from public.quran_translations")).toHaveLength(1);
  });
});

describe("discussion and moderation", () => {
  let thread: string;
  beforeAll(async () => {
    [{ id: thread }] = (await db.as<{ id: string }>(alice, "insert into public.discussions (content_type, content_id, title) values ('journey_stop', 'yusuf', 'About the outline') returning id")) as [{ id: string }];
  });
  test("reading is public; posting needs an account", async () => {
    expect(await db.as(null, "select title from public.discussions")).toEqual([{ title: "About the outline" }]);
    await rejects(db.as(null, "insert into public.comments (discussion_id, author_id, body) values ($1, $2, 'hi')", [thread, alice]), /permission denied/);
  });
  test("a reply notifies the parent's author, who follows their own thread", async () => {
    const [c] = await db.as<{ id: string }>(alice, "insert into public.comments (discussion_id, body) values ($1, 'First question') returning id", [thread]);
    await db.as(bob, "insert into public.comments (discussion_id, parent_id, body, citation) values ($1, $2, 'A reply', 'Q 12:3')", [thread, c!.id]);
    const n = await db.as<{ kind: string }>(alice, "select kind from public.notifications");
    expect(n.map((x) => x.kind)).toContain("thread_activity");
  });
  test("authors edit within the window and keep a revision; others cannot", async () => {
    const [c] = await db.as<{ id: string }>(bob, "insert into public.comments (discussion_id, body) values ($1, 'Original words') returning id", [thread]);
    const upd = await db.as(alice, "update public.comments set body = 'hijack' where id = $1 returning id", [c!.id]);
    expect(upd).toHaveLength(0);
    await db.as(bob, "update public.comments set body = 'Edited words' where id = $1", [c!.id]);
    const rev = await db.admin<{ previous_body: string }>("select previous_body from public.comment_revisions where comment_id = $1", [c!.id]);
    expect(rev).toEqual([{ previous_body: "Original words" }]);
    await db.admin("update public.comments set created_at = now() - interval '2 hours' where id = $1", [c!.id]);
    expect(await db.as(bob, "update public.comments set body = 'Too late' where id = $1 returning id", [c!.id])).toHaveLength(0);
  });
  test("users cannot hide or remove comments themselves", async () => {
    const [c] = await db.as<{ id: string }>(alice, "insert into public.comments (discussion_id, body) values ($1, 'Mine') returning id", [thread]);
    expect(await db.as(alice, "update public.comments set status = 'visible', body = body where id = $1 returning id", [c!.id])).toHaveLength(1);
    await rejects(db.as(alice, "update public.comments set status = 'removed' where id = $1", [c!.id]), /row-level security/);
  });
  test("three reports hide a comment, which keeps its place with the body blanked", async () => {
    const [c] = await db.as<{ id: string }>(alice, "insert into public.comments (discussion_id, body) values ($1, 'A misleading claim') returning id", [thread]);
    for (const u of [bob, editor, reviewer]) await db.as(u, "insert into public.reports (target_type, target_id, reason) values ('comment', $1, 'misleading')", [c!.id]);
    const [pub] = await db.as<{ status: string; body: string | null }>(null, "select status, body from public.comments_public where id = $1", [c!.id]);
    expect(pub).toEqual({ status: "hidden", body: null });
    const [m] = await db.as<{ body: string }>(moderator, "select body from public.comments_public where id = $1", [c!.id]);
    expect(m!.body).toBe("A misleading claim");
  });
  test("moderation is for moderators, applies atomically and logs without copying bodies", async () => {
    const [c] = await db.as<{ id: string }>(bob, "insert into public.comments (discussion_id, body) values ($1, 'Spam spam') returning id", [thread]);
    await db.as(alice, "insert into public.reports (target_type, target_id, reason) values ('comment', $1, 'spam')", [c!.id]);
    await rejects(db.as(alice, "select public.moderate('comment', $1, 'remove', 'spam')", [c!.id]), /moderators only/);
    await db.as(moderator, "select public.moderate('comment', $1, 'remove', 'spam')", [c!.id]);
    const [row] = await db.admin<{ status: string }>("select status from public.comments where id = $1", [c!.id]);
    expect(row!.status).toBe("removed");
    const [r] = await db.admin<{ status: string }>("select status from public.reports where target_id = $1", [c!.id]);
    expect(r!.status).toBe("actioned");
    const log = await db.as<Record<string, unknown>>(moderator, "select * from public.moderation_actions where target_id = $1", [c!.id]);
    expect(log).toHaveLength(1);
    expect(JSON.stringify(log)).not.toContain("Spam spam");
    expect(await db.as(alice, "select * from public.moderation_actions")).toHaveLength(0);
  });
  test("posting is rate limited", async () => {
    const carol = await db.createUser("carol@test.local");
    for (let i = 0; i < 5; i++) await db.as(carol, "insert into public.comments (discussion_id, body) values ($1, $2)", [thread, `Comment number ${i}`]);
    await rejects(db.as(carol, "insert into public.comments (discussion_id, body) values ($1, 'one too many')", [thread]), /rate_limited/);
  });
  test("a banned user cannot post", async () => {
    const dave = await db.createUser("dave@test.local");
    await db.as(moderator, "insert into public.bans (user_id, reason_code, created_by) values ($1, 'spam', $2)", [dave, moderator]);
    await rejects(db.as(dave, "insert into public.comments (discussion_id, body) values ($1, 'hello')", [thread]), /suspended/);
  });
});

describe("account data", () => {
  test("export returns only the caller's data", async () => {
    const [r] = await db.as<{ d: { bookmarks: Array<{ user_id: string }>; notes: unknown[] } }>(alice, "select public.export_my_data() d");
    expect(r!.d.bookmarks.every((b) => b.user_id === alice)).toBe(true);
    expect(r!.d.notes).toHaveLength(1);
  });
  test("deleting the auth user cascades to personal data", async () => {
    const erin = await db.createUser("erin@test.local");
    await db.as(erin, "insert into public.bookmarks (target_type, target_id) values ('journey_stop', 'nuh')");
    await db.as(erin, "insert into public.private_notes (target_type, target_id, body) values ('journey_stop', 'nuh', 'x')");
    await db.admin("delete from auth.users where id = $1", [erin]);
    const [n] = await db.admin<{ n: number }>("select (select count(*) from public.bookmarks where user_id = $1) + (select count(*) from public.private_notes where user_id = $1) + (select count(*) from public.profiles where id = $1) as n", [erin]);
    expect(Number(n!.n)).toBe(0);
  });
  test("unsubscribe works by token without signing in", async () => {
    const [p] = await db.admin<{ unsubscribe_token: string }>("select unsubscribe_token from public.notification_prefs where user_id = $1", [bob]);
    const [r] = await db.as<{ ok: boolean }>(null, "select public.unsubscribe($1) ok", [p!.unsubscribe_token]);
    expect(r!.ok).toBe(true);
  });
  test("roles: only admins grant roles, users cannot grant themselves", async () => {
    await rejects(db.as(alice, "insert into public.role_assignments (user_id, role, granted_by) values ($1, 'admin', $1)", [alice]), /row-level security/);
    await db.as(admin, "insert into public.role_assignments (user_id, role, granted_by) values ($1, 'moderator', $2)", [bob, admin]);
    expect(await db.as(alice, "select * from public.audit_logs")).toHaveLength(0);
    expect((await db.as(admin, "select * from public.audit_logs where entity_type = 'role_assignments'")).length).toBeGreaterThan(0);
  });
});

describe("search", () => {
  test("Arabic normalisation ignores vowel marks and letter variants", async () => {
    const [r] = await db.admin<{ a: string; b: string }>("select public.normalize_arabic('إِبْرَاهِيمُ') a, public.normalize_arabic('ابراهيم') b");
    expect(r!.a).toBe(r!.b);
  });
  test("transliteration variants match", async () => {
    const [r] = await db.admin<{ a: string }>("select public.normalize_latin('Shu''ayb') a");
    expect(r!.a).toBe("shuayb");
  });
});

describe("read RPCs", () => {
  test("the atlas returns published geometries as GeoJSON and unknown places without coordinates", async () => {
    const [loc] = await db.as<{ id: string }>(editor, "insert into public.locations (slug, name_en, type) values ('rpc-unknown', 'Unknown site', 'site') returning id");
    await db.admin("update public.locations set status = 'published' where id = $1", [loc!.id]);
    const claim = await newClaim(editor, "A place that the sources do not locate");
    await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 12, 1)", [claim]);
    await db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [claim, reviewer]);
    await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [claim]);
    const [g] = await db.as<{ id: string }>(editor, "insert into public.place_geometries (location_id, precision, confidence, claim_id) values ($1, 'unknown', 'unknown', $2) returning id", [loc!.id, claim]);
    await db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('place_geometry', $1, $2, 'approved')", [g!.id, reviewer]);
    await db.as(editor, "update public.place_geometries set status = 'published' where id = $1", [g!.id]);
    const rows = await db.as<{ location_slug: string; geojson: unknown; geom_precision: string }>(null, "select * from public.atlas_places(null, null)");
    const u = rows.find((r) => r.location_slug === "rpc-unknown");
    expect(u).toMatchObject({ geojson: null, geom_precision: "unknown" });
  });
  test("the person graph returns only published people and edges, each with its claim", async () => {
    const mk = async (slug: string) => {
      const [p] = await db.as<{ id: string }>(editor, "insert into public.people (slug, name_en, name_ar, kind) values ($1, $1, 'x', 'prophet') returning id", [slug]);
      await db.admin("update public.people set status = 'published' where id = $1", [p!.id]);
      return p!.id;
    };
    const a = await mk("graph-a");
    const b = await mk("graph-b");
    const claim = await newClaim(editor, "Graph fixture relationship claim");
    await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 12, 2)", [claim]);
    await db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [claim, reviewer]);
    await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [claim]);
    const [r] = await db.as<{ id: string }>(editor, "insert into public.relationships (person_from, person_to, kind, claim_id, confidence) values ($1, $2, 'parent_of', $3, 'quran') returning id", [a, b, claim]);
    let [g] = await db.as<{ g: { edges: unknown[] } }>(null, "select public.person_graph('graph-a', 2) g");
    expect(g!.g.edges).toHaveLength(0);
    await db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('relationship', $1, $2, 'approved')", [r!.id, reviewer]);
    await db.as(editor, "update public.relationships set status = 'published' where id = $1", [r!.id]);
    [g] = await db.as<{ g: { edges: Array<{ claim: { references: unknown[] } }> } }>(null, "select public.person_graph('graph-a', 2) g");
    expect(g!.g.edges).toHaveLength(1);
    expect((g!.g.edges[0] as { claim: { references: unknown[] } }).claim.references).toHaveLength(1);
    expect((await db.as<{ g: unknown }>(null, "select public.person_graph('nobody', 2) g"))[0]!.g).toBeNull();
  });
});

describe("media assets", () => {
  test("an image cannot depict a person, cannot be published without an approver, nor from an uncleared source", async () => {
    const [src] = await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('image', 'Fixture photo archive', 'requested') returning id");
    const [ok] = await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('image', 'Fixture cleared archive', 'cleared') returning id");
    const base = "insert into public.assets (storage_path, kind, alt_text, credit, source_id, mime_type, bytes, depicts_person, status, approved_by) values ($1, 'image', 'A geometric tile pattern', 'Fixture', $2, 'image/png', 1000, $3, $4, $5)";
    await rejects(db.as(editor, base, ["a.png", ok!.id, true, "draft", null]), /check constraint/);
    await rejects(db.admin(base, ["b.png", ok!.id, false, "published", null]), /check constraint/);
    await rejects(db.admin(base, ["c.png", src!.id, false, "published", admin]), /rights are not cleared/);
    await db.admin("update public.sources set rights_status = 'cleared' where id = $1", [src!.id]);
    await db.admin(base, ["d.png", src!.id, false, "published", admin]);
  });
});
