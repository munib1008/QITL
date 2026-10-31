// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Qira'at & Ahruf Learning Centre and the content licence registry: permission statuses, APPROVED by admins only,
 * riwayah matching between text and audio, the variant publish guards and RLS.
 * Every Arabic-looking string below is a TEST FIXTURE placeholder, never Quran text or a reading.
 */
const HAFS_VERSE = "[TEST FIXTURE hafs] fixa fixb fixc";
const WARSH_VERSE = "[TEST FIXTURE warsh] fixd fixe";

let db: Db;
let editor: string, editor2: string, scholar: string, admin: string, alice: string;
let tanzilEdition: string, tanzilSource: string, tanzilPerm: string;
let warshSource: string, warshPerm: string, warshEdition: string;
let audioSource: string, audioPermHafs: string;
let approvedClaim: string, draftClaim: string;

const one = async <T = { id: string }>(p: Promise<T[]>) => (await p)[0]!;
const review = (who: string, type: string, id: string, decision = "approved") =>
  db.as(who, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ($1, $2, $3, $4)", [type, id, who, decision]);

async function claim(approve: boolean): Promise<string> {
  const c = await one(db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ($1, 'quran', $2) returning id", [`Fixture claim ${Math.random()}`, editor]));
  await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 1, 1)", [c.id]);
  if (approve) {
    await review(scholar, "claim", c.id);
    await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [c.id]);
  }
  return c.id;
}

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("editor@test.local", ["editor"]);
  editor2 = await db.createUser("editor2@test.local", ["editor"]);
  scholar = await db.createUser("scholar@test.local", ["scholarly_reviewer"]);
  admin = await db.createUser("admin@test.local", ["admin"]);
  alice = await db.createUser("alice@test.local");

  const e = await one(db.admin<{ id: string; source_id: string; permission_id: string; source_version_id: string }>("select id, source_id, permission_id, source_version_id from public.quran_text_editions where is_default"));
  tanzilEdition = e.id;
  tanzilSource = e.source_id;
  tanzilPerm = e.permission_id;
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (1, 'x', 'Fixture', 7, $1)", [e.source_version_id]);
  await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (1, 1, $1, $2), (1, 2, $1, $2)", [HAFS_VERSE, e.source_version_id]);

  // A licensed Warsh edition (test fixture source), set up by the admin.
  warshSource = (await one(db.as<{ id: string }>(admin, "insert into public.sources (type, work, edition) values ('quran_text', 'Fixture Warsh text', 'test') returning id"))).id;
  warshPerm = (
    await one(
      db.as<{ id: string }>(
        admin,
        "insert into public.content_permissions (source_id, asset_type, scope, status, riwayah_id, conditions, attribution_text) values ($1, 'text', 'warsh', 'CONDITIONAL', 'warsh', 'fixture conditions', 'Fixture attribution') returning id",
        [warshSource],
      ),
    )
  ).id;
  warshEdition = (await one(db.as<{ id: string }>(admin, "insert into public.quran_text_editions (riwayah_id, title, source_id, permission_id) values ('warsh', 'Fixture Warsh edition', $1, $2) returning id", [warshSource, warshPerm]))).id;
  await db.admin("insert into public.quran_edition_verses (edition_id, surah, ayah, text_ar) values ($1, 1, 1, $2)", [warshEdition, WARSH_VERSE]);

  audioSource = (await one(db.admin<{ id: string }>("select id from public.sources where work = 'King Fahd Complex Quran audio library'"))).id;
  audioPermHafs = (await one(db.admin<{ id: string }>("select id from public.content_permissions where source_id = $1 and scope = 'hafs'", [audioSource]))).id;

  approvedClaim = await claim(true);
  draftClaim = await claim(false);
}, 300_000);

describe("reference rows: ten readers, twenty transmitters", () => {
  test("seeded as drafts with names only, invisible to the public", async () => {
    const r = await db.admin<{ n: number; drafts: number }>("select count(*)::int n, count(*) filter (where status = 'draft')::int drafts from public.qiraat");
    expect(r[0]).toEqual({ n: 10, drafts: 10 });
    const w = await db.admin<{ qiraah_id: string; n: number }>("select qiraah_id, count(*)::int n from public.riwayat where status = 'draft' group by 1");
    expect(w).toHaveLength(10);
    expect(w.every((x) => x.n === 2)).toBe(true);
    const cols = (await db.admin<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'riwayat'")).map((c) => c.column_name);
    expect(cols.some((c) => /^(born|died|birth|death|dates?)$|bio|chain|lineage/.test(c))).toBe(false);
    expect(await db.as(null, "select * from public.qiraat")).toEqual([]);
    expect(await db.as(alice, "select * from public.riwayat")).toEqual([]);
    expect((await db.as(editor, "select * from public.riwayat")).length).toBe(20);
  });

  test("a reference row publishes only after a scholarly approval", async () => {
    await rejects(db.as(editor, "update public.riwayat set status = 'published' where id = 'hafs'"), /needs a scholarly approval/);
    await db.as(scholar, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('qiraat_riwayah', public.qiraat_ref_uuid('riwayah', 'hafs'), $1, 'approved')", [scholar]);
    await db.as(editor, "update public.riwayat set status = 'published' where id = 'hafs'");
    expect((await db.as<{ id: string }>(null, "select id from public.riwayat")).map((r) => r.id)).toEqual(["hafs"]);
    await rejects(db.as(editor, "update public.riwayat set name_translit = 'Changed' where id = 'hafs'"), /cannot be edited in place/);
  });

  test("only editors write reference rows", async () => {
    await rejects(db.as(alice, "insert into public.qiraat (id, position, name_ar, name_translit) values ('x_reader', 1, 'xx', 'xx')"), /row-level security|permission denied/);
  });
});

describe("licence registry", () => {
  test("seeded rows: none APPROVED, none verified, Tanzil text CONDITIONAL with its conditions", async () => {
    const rows = await db.admin<{ status: string; verified_by: string | null; work: string; asset_type: string; scope: string; conditions: string | null; evidence_url: string | null }>(
      "select status, verified_by, work, asset_type, scope, conditions, evidence_url from public.content_licence_registry where evidence_checked_on = '2026-10-31'",
    );
    expect(rows.length).toBeGreaterThan(15);
    expect(rows.filter((r) => r.status === "APPROVED" || r.verified_by)).toEqual([]);
    expect(rows.every((r) => r.evidence_url?.startsWith("https://"))).toBe(true);
    const tanzil = rows.find((r) => r.work === "Tanzil Quran Text (Uthmani)" && r.asset_type === "text");
    expect(tanzil?.status).toBe("CONDITIONAL");
    expect(tanzil?.conditions).toMatch(/Verbatim/);
    expect(rows.find((r) => r.work === "sunnah.com API" && r.asset_type === "api")?.status).toBe("PERMISSION_REQUIRED");
    expect(rows.find((r) => r.work === "King Fahd Complex Quran developer platform" && r.scope === "warsh")?.status).toBe("PERMISSION_REQUIRED");
    // The audio library has no attribution text yet, so nothing from it is allowed for display.
    expect((await one(db.admin<{ ok: boolean }>("select public.content_permission_allowed($1) ok", [audioPermHafs]))).ok).toBe(false);
    expect((await one(db.admin<{ ok: boolean }>("select public.content_permission_allowed($1) ok", [tanzilPerm]))).ok).toBe(true);
  });

  test("the status set is closed and CONDITIONAL needs its conditions", async () => {
    await rejects(db.as(admin, "insert into public.content_permissions (source_id, asset_type, scope, status) values ($1, 'image', 'x1', 'MAYBE')", [warshSource]), /check constraint/);
    await rejects(db.as(admin, "insert into public.content_permissions (source_id, asset_type, scope, status) values ($1, 'image', 'x2', 'CONDITIONAL')", [warshSource]), /check constraint/);
    await rejects(db.as(admin, "insert into public.content_permissions (source_id, asset_type, scope) values ($1, 'video', 'x3')", [warshSource]), /check constraint/);
  });

  test("only an admin approves; the database stamps the admin; APPROVED needs a licence reference and evidence", async () => {
    expect(await db.as(editor, "update public.content_permissions set status = 'APPROVED' where id = $1 returning id", [tanzilPerm])).toEqual([]);
    const still = await one(db.admin<{ status: string }>("select status from public.content_permissions where id = $1", [tanzilPerm]));
    expect(still.status).toBe("CONDITIONAL");
    // The owner connection (a migration or a script) cannot approve either: there is no admin behind it.
    await rejects(db.admin("update public.content_permissions set status = 'APPROVED' where id = $1", [tanzilPerm]), /only an admin/);
    await rejects(
      db.admin("insert into public.content_permissions (source_id, asset_type, scope, status, licence_ref, evidence_url, verified_by, verified_at) values ($1, 'image', 'x4', 'APPROVED', 'x', 'https://example.test', $2, now())", [warshSource, admin]),
      /only an admin/,
    );
    await rejects(db.as(admin, "insert into public.content_permissions (source_id, asset_type, scope, status) values ($1, 'image', 'x5', 'APPROVED')", [warshSource]), /check constraint/);
    const r = await one(
      db.as<{ verified_by: string; verified_at: string }>(
        admin,
        "insert into public.content_permissions (source_id, asset_type, scope, status, licence_ref, evidence_url, verified_by) values ($1, 'image', 'x6', 'APPROVED', 'Written permission ref FIXTURE-1', 'https://example.test/permission', $2) returning verified_by, verified_at",
        [warshSource, editor],
      ),
    );
    expect(r.verified_by).toBe(admin); // never the name typed in
    expect(r.verified_at).toBeTruthy();
  });

  test("everyone can read the registry; only admins write it", async () => {
    expect((await db.as(null, "select id from public.content_permissions")).length).toBeGreaterThan(15);
    await rejects(db.as(editor, "insert into public.content_permissions (source_id, asset_type, scope) values ($1, 'image', 'x7')", [warshSource]), /row-level security/);
    expect(await db.as(editor, "update public.content_permissions set notes = 'x' where id = $1 returning id", [tanzilPerm])).toEqual([]);
  });
});

describe("text editions", () => {
  test("Tanzil Hafs v1.1 is the one seeded edition, linked to its source, version and permission", async () => {
    const eds = await db.as<{ riwayah_id: string; title: string; source_id: string }>(null, "select riwayah_id, title, source_id from public.quran_text_editions where source_id <> $1", [warshSource]);
    expect(eds).toEqual([{ riwayah_id: "hafs", title: "Tanzil Quran Text (Uthmani), version 1.1", source_id: tanzilSource }]);
  });

  test("an edition's permission must be its own source's text permission for the same riwayah", async () => {
    await rejects(db.as(admin, "insert into public.quran_text_editions (riwayah_id, title, source_id, permission_id) values ('qalun', 'Wrong', $1, $2)", [warshSource, warshPerm]), /covers riwayah warsh/);
    await rejects(db.as(admin, "insert into public.quran_text_editions (riwayah_id, title, source_id, permission_id) values ('hafs', 'Wrong', $1, $2)", [warshSource, tanzilPerm]), /own source/);
    await rejects(db.as(editor, "insert into public.quran_text_editions (riwayah_id, title, source_id) values ('hafs', 'Editor edition', $1)", [warshSource]), /row-level security/);
  });

  test("edition text is imported only under an allowing licence and never edited", async () => {
    const blocked = await one(db.as<{ id: string }>(admin, "insert into public.content_permissions (source_id, asset_type, scope, status) values ($1, 'text', 'qalun', 'PERMISSION_REQUIRED') returning id", [warshSource]));
    const ed = await one(db.as<{ id: string }>(admin, "insert into public.quran_text_editions (riwayah_id, title, source_id, permission_id) values ('qalun', 'Fixture Qalun', $1, $2) returning id", [warshSource, blocked.id]));
    await rejects(db.admin("insert into public.quran_edition_verses (edition_id, surah, ayah, text_ar) values ($1, 1, 1, 'x')", [ed.id]), /does not allow importing/);
    await rejects(db.admin("update public.quran_edition_verses set text_ar = 'y' where edition_id = $1", [warshEdition]), /immutable/);
    await rejects(db.as(admin, "insert into public.quran_edition_verses (edition_id, surah, ayah, text_ar) values ($1, 1, 2, 'x')", [warshEdition]), /permission denied/);
  });
});

describe("variants", () => {
  let variant: string;
  test("readings are copied from an allowed edition of the same riwayah, found in its text", async () => {
    variant = (await one(db.as<{ id: string }>(editor, "insert into public.qiraat_variants (surah, ayah, word_position, kind) values (1, 1, 2, 'vocalization') returning id"))).id;
    await rejects(db.as(editor, "insert into public.qiraat_variant_readings (variant_id, riwayah_id, edition_id, reading_text) values ($1, 'warsh', $2, 'fixa')", [variant, tanzilEdition]), /must come from an edition of warsh/);
    await rejects(db.as(editor, "insert into public.qiraat_variant_readings (variant_id, riwayah_id, edition_id, reading_text) values ($1, 'hafs', $2, 'typed in')", [variant, tanzilEdition]), /copied from the edition/);
    await db.as(editor, "insert into public.qiraat_variant_readings (variant_id, riwayah_id, edition_id, reading_text) values ($1, 'hafs', $2, 'fixb')", [variant, tanzilEdition]);
  });

  test("publishing needs two riwayat, approved claims and a scholarly approval", async () => {
    await rejects(db.as(editor, "update public.qiraat_variants set status = 'published' where id = $1", [variant]), /at least two riwayat/);
    await db.as(editor, "insert into public.qiraat_variant_readings (variant_id, riwayah_id, edition_id, reading_text) values ($1, 'warsh', $2, 'fixd')", [variant, warshEdition]);
    await rejects(db.as(editor, "update public.qiraat_variants set status = 'published' where id = $1", [variant]), /needs an explanation claim/);
    await db.as(editor, "insert into public.qiraat_variant_claims (variant_id, claim_id) values ($1, $2)", [variant, draftClaim]);
    await rejects(db.as(editor, "update public.qiraat_variants set status = 'published' where id = $1", [variant]), /must be approved/);
    await db.as(editor, "delete from public.qiraat_variant_claims where variant_id = $1", [variant]);
    await db.as(editor, "insert into public.qiraat_variant_claims (variant_id, claim_id) values ($1, $2)", [variant, approvedClaim]);
    await rejects(db.as(editor, "update public.qiraat_variants set status = 'published' where id = $1", [variant]), /scholarly approval/);
    await rejects(review(editor, "qiraat_variant", variant), /scholarly reviewer|row-level security/);
    await review(scholar, "qiraat_variant", variant);
    expect(await db.as(null, "select id from public.qiraat_variants")).toEqual([]);
    await db.as(editor, "update public.qiraat_variants set status = 'published' where id = $1", [variant]);
    expect((await db.as(null, "select reading_text from public.qiraat_variant_readings order by riwayah_id")).map((r) => (r as { reading_text: string }).reading_text)).toEqual(["fixb", "fixd"]);
    await rejects(db.as(editor, "update public.qiraat_variants set word_position = 3 where id = $1", [variant]), /cannot be edited in place/);
    await rejects(db.as(editor, "delete from public.qiraat_variant_readings where variant_id = $1", [variant]), /cannot change/);
  });

  test("a licence downgrade hides a published variant at once", async () => {
    await db.as(admin, "update public.content_permissions set status = 'BLOCKED' where id = $1", [warshPerm]);
    expect(await db.as(null, "select id from public.qiraat_variants")).toEqual([]);
    expect(await db.as(null, "select id from public.qiraat_variant_readings")).toEqual([]);
    await db.as(admin, "update public.content_permissions set status = 'CONDITIONAL' where id = $1", [warshPerm]);
    expect((await db.as(null, "select id from public.qiraat_variants")).length).toBe(1);
  });

  test("a reviewer cannot approve a variant they created", async () => {
    const own = await one(db.admin<{ id: string }>("insert into public.qiraat_variants (surah, ayah, word_position, kind, created_by) values (1, 2, 1, 'pronunciation', $1) returning id", [scholar]));
    await rejects(review(scholar, "qiraat_variant", own.id), /own record/);
  });
});

describe("reciters and recordings", () => {
  let reciter: string;
  beforeAll(async () => {
    reciter = (await one(db.as<{ id: string }>(editor, "insert into public.reciters (name_translit) values ('Fixture Reciter') returning id"))).id;
    await review(scholar, "reciter", reciter);
    await db.as(editor, "update public.reciters set status = 'published' where id = $1", [reciter]);
  });

  test("a recording needs the recording permission of its own source, for its riwayah", async () => {
    await rejects(
      db.as(editor, "insert into public.audio_recordings (reciter_id, riwayah_id, source_id, permission_id, surah, url) values ($1, 'hafs', $2, $3, 1, 'https://example.test/a.mp3')", [reciter, tanzilSource, tanzilPerm]),
      /recording permission/,
    );
    await rejects(
      db.as(editor, "insert into public.audio_recordings (reciter_id, riwayah_id, source_id, permission_id, surah, url) values ($1, 'warsh', $2, $3, 1, 'https://example.test/a.mp3')", [reciter, audioSource, audioPermHafs]),
      /covers riwayah hafs/,
    );
  });

  test("text/audio riwayah mismatch is refused unless it is an explained comparison", async () => {
    const qalunPerm = (await one(db.admin<{ id: string }>("select id from public.content_permissions where source_id = $1 and scope = 'qalun'", [audioSource]))).id;
    await rejects(
      db.as(editor, "insert into public.audio_recordings (reciter_id, riwayah_id, source_id, permission_id, surah, url, shown_with_edition_id) values ($1, 'qalun', $2, $3, 1, 'https://example.test/q.mp3', $4)", [reciter, audioSource, qalunPerm, tanzilEdition]),
      /riwayah mismatch/,
    );
    await rejects(
      db.as(editor, "insert into public.audio_recordings (reciter_id, riwayah_id, source_id, permission_id, surah, url, shown_with_edition_id, is_comparison, comparison_note) values ($1, 'qalun', $2, $3, 1, 'https://example.test/q.mp3', $4, true, 'short')", [reciter, audioSource, qalunPerm, tanzilEdition]),
      /check constraint/,
    );
    await db.as(
      editor,
      "insert into public.audio_recordings (reciter_id, riwayah_id, source_id, permission_id, surah, url, shown_with_edition_id, is_comparison, comparison_note) values ($1, 'qalun', $2, $3, 1, 'https://example.test/q.mp3', $4, true, 'Fixture: an explained educational comparison of two riwayat.')",
      [reciter, audioSource, qalunPerm, tanzilEdition],
    );
  });

  test("a recording is public only when published, reviewed and its permission allows display", async () => {
    const rec = await one(
      db.as<{ id: string }>(editor, "insert into public.audio_recordings (reciter_id, riwayah_id, source_id, permission_id, surah, url, shown_with_edition_id) values ($1, 'hafs', $2, $3, 1, 'https://example.test/h.mp3', $4) returning id", [
        reciter,
        audioSource,
        audioPermHafs,
        tanzilEdition,
      ]),
    );
    await review(scholar, "audio_recording", rec.id);
    await rejects(db.as(editor, "update public.audio_recordings set status = 'published' where id = $1", [rec.id]), /does not allow display/);
    await db.as(admin, "update public.content_permissions set attribution_text = 'Fixture attribution' where id = $1", [audioPermHafs]);
    await db.as(editor, "update public.audio_recordings set status = 'published' where id = $1", [rec.id]);
    expect((await db.as(null, "select id from public.audio_recordings")).length).toBe(1);
    await db.as(admin, "update public.content_permissions set status = 'BLOCKED' where id = $1", [audioPermHafs]);
    expect(await db.as(null, "select id from public.audio_recordings")).toEqual([]);
    expect(await db.as(alice, "select id from public.audio_recordings")).toEqual([]);
  });

  test("the public never sees drafts; plain users cannot write", async () => {
    expect(await db.as(null, "select id from public.reciters where status <> 'published'")).toEqual([]);
    await rejects(db.as(alice, "insert into public.reciters (name_translit) values ('Nope')"), /row-level security/);
    await rejects(db.as(editor2, "insert into public.reciters (name_translit, status) values ('Nope', 'published')"), /row-level security|scholarly approval/);
  });
});

describe("transmission routes", () => {
  test("none seeded; every route carries a citation; publish needs review and an approved claim", async () => {
    expect(await db.admin("select id from public.transmission_routes")).toEqual([]);
    await rejects(db.as(editor, "insert into public.transmission_routes (riwayah_id, name_translit) values ('hafs', 'Fixture route')"), /check constraint/);
    const r = await one(db.as<{ id: string }>(editor, "insert into public.transmission_routes (riwayah_id, name_translit, claim_id) values ('hafs', 'Fixture route', $1) returning id", [draftClaim]));
    await review(scholar, "transmission_route", r.id);
    await rejects(db.as(editor, "update public.transmission_routes set status = 'published' where id = $1", [r.id]), /claim is not approved/);
    await db.as(editor, "update public.transmission_routes set claim_id = $2 where id = $1", [r.id, approvedClaim]);
    await db.as(editor, "update public.transmission_routes set status = 'published' where id = $1", [r.id]);
    expect((await db.as(null, "select id from public.transmission_routes")).length).toBe(1);
  });
});

describe("misconceptions", () => {
  test("answered only by an approved claim, after a scholarly approval", async () => {
    const m = await one(db.as<{ id: string }>(editor, "insert into public.qiraat_misconceptions (question, claim_id) values ('Fixture question?', $1) returning id", [draftClaim]));
    await review(scholar, "qiraat_misconception", m.id);
    await rejects(db.as(editor, "update public.qiraat_misconceptions set status = 'published' where id = $1", [m.id]), /claim is not approved/);
    await db.as(editor, "update public.qiraat_misconceptions set claim_id = $2 where id = $1", [m.id, approvedClaim]);
    await db.as(editor, "update public.qiraat_misconceptions set status = 'published' where id = $1", [m.id]);
    expect((await db.as(null, "select id from public.qiraat_misconceptions")).length).toBe(1);
    await rejects(db.as(editor, "insert into public.qiraat_misconceptions (question) values ('No claim?')"), /null value|not-null/);
  });
});
