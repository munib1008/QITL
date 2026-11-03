// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { checkAsmaText } from "@/lib/asma/text-validator";
import { createDb, rejects, type Db } from "./harness";

/**
 * Asma' al-Husna (20261031002900): computed counts, evidence placeholders, the version-bound review, the AI-draft pathway,
 * the re-review flags and private learning. Fixture text is a labelled placeholder, never Quran or hadith text.
 */
const FIXTURE = "[TEST FIXTURE — placeholder, not Quran or hadith text]";
const LABEL = "Suggested personal wording — not a quoted Quranic verse or Prophetic dua";

let db: Db;
let editor: string, editor2: string, scholar: string, both: string, admin: string, plain: string, other: string;
let methodology: string, srcId: string;
let hBukhari: string, hBukhariGrade: string, hAbuDawud: string, hAbuDawudGrade: string, hTirmidhiHasan: string, hTirmidhiHasanGrade: string, hTirmidhiSahih: string, hTirmidhiSahihGrade: string;
let n = 0;
const HASH = "a".repeat(64);

const mkName = async (extra: Record<string, unknown> = {}, who = editor): Promise<string> => {
  n += 1;
  const f = { slug: `fx-name-${n}`, name_ar: "الغفور", name_ar_vowelled: "ٱلْغَفُورُ", transliteration: "Fixture", rendering_en: "A fixture gloss", rendering_ar: "تجربة", rendering_ur: "تجربہ", surface_forms: ["الغفور"], ai_generated: true, ...extra };
  const cols = Object.keys(f);
  const [r] = await db.as<{ id: string }>(who, `insert into public.divine_names (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) returning id`, Object.values(f));
  return r!.id;
};
const rows = (a: number, b = 0, c = 0): Array<Record<string, string | number>> => [
  ...Array.from({ length: a }, (_, i) => ({ surah: 1, ayah: 1 + (i % 7), token: i + 1, measure: "A", relation: "direct", form: "الغفور", raw: "ٱلْغَفُورُ" })),
  ...Array.from({ length: b }, (_, i) => ({ surah: 2, ayah: 255, token: i + 1, measure: "B", relation: "direct", form: "للغفور", raw: "لِلْغَفُورِ" })),
  ...Array.from({ length: c }, (_, i) => ({ surah: 112, ayah: 1 + (i % 4), token: 50 + i, measure: "C", relation: "related", form: "غفران", raw: "غُفْرَانَ", root: "غ-ف-ر" })),
];
const compute = (id: string, r = rows(3, 1, 2)) => db.as(admin, "select public.asma_replace_occurrences($1, $2, $3, $4::jsonb)", [id, methodology, HASH, JSON.stringify(r)]);
const review = (who: string, type: string, id: string, decision = "approved") =>
  db.as(who, "insert into public.divine_name_reviews (entity_type, entity_id, reviewer_id, decision) values ($1, $2, $3, $4)", [type, id, who, decision]);
const sel = async (sql: string, p: unknown[] = []) => db.admin<Record<string, unknown>>(sql, p);
const state = async (id: string) => (await sel("select status, visibility, integrity_status, scholarly_status, version, classification_version, needs_rereview from public.divine_names where id = $1", [id]))[0]!;
/** A Name that is computed, checked, reviewed and published. */
async function publishedName(extra: Record<string, unknown> = {}): Promise<string> {
  const id = await mkName(extra);
  await compute(id);
  await db.as(editor, "select public.run_asma_integrity('divine_name', $1)", [id]);
  await review(scholar, "divine_name", id);
  await db.as(editor, "update public.divine_names set status = 'published' where id = $1", [id]);
  return id;
}

beforeAll(async () => {
  db = await createDb({ supabaseDefaults: true });
  editor = await db.createUser("editor@test.local", ["editor"]);
  editor2 = await db.createUser("editor2@test.local", ["editor"]);
  scholar = await db.createUser("scholar@test.local", ["scholarly_reviewer"]);
  both = await db.createUser("both@test.local", ["editor", "scholarly_reviewer"]);
  admin = await db.createUser("admin@test.local", ["admin"]);
  plain = await db.createUser("plain@test.local");
  other = await db.createUser("other@test.local");
  const [{ id: src }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id")) as [{ id: string }];
  srcId = src;
  const [{ id: ver }] = (await db.admin<{ id: string }>("insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id", [src])) as [{ id: string }];
  for (const [id, cnt] of [[1, 7], [2, 286], [112, 4]]) await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values ($1, 'x', 'Fixture', $2, $3)", [id, cnt, ver]);
  for (let a = 1; a <= 7; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (1, $1, $2, $3)", [a, FIXTURE, ver]);
  await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (2, 255, $1, $2)", [FIXTURE, ver]);
  for (let a = 1; a <= 4; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (112, $1, $2, $3)", [a, FIXTURE, ver]);
  const hadith = async (collection: string, num: string, grade: string) => {
    const [h] = await db.admin<{ id: string }>("insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic) values ($1, 'fixture', $2, $3, $4) returning id", [collection, num, ver, FIXTURE]);
    const [g] = await db.admin<{ id: string }>("insert into public.hadith_gradings (hadith_id, grader, grade, grade_label, source_id, citation) values ($1, 'Fixture grader', $2, $2, $3, 'fixture') returning id", [h!.id, grade, src]);
    return [h!.id, g!.id] as const;
  };
  [hBukhari, hBukhariGrade] = await hadith("bukhari", "1", "sahih");
  [hAbuDawud, hAbuDawudGrade] = await hadith("abudawud", "2", "sahih");
  [hTirmidhiHasan, hTirmidhiHasanGrade] = await hadith("tirmidhi", "3", "hasan");
  [hTirmidhiSahih, hTirmidhiSahihGrade] = await hadith("tirmidhi", "4", "sahih");
  const [m] = await db.as<{ id: string }>(admin, "insert into public.divine_name_occurrence_methodologies (version, normalisation_policy, tokenisation_policy, query_version, edition_source, edition_version, edition_sha256, edition_content_sha256, description, is_current) values ('fixture-v1', 'asma-norm-v1', 'asma-tok-v1', 'asma-query-v1', 'Fixture', 'f1', $1, $1, 'Fixture methodology for the database tests', true) returning id", [HASH]);
  methodology = m!.id;
}, 240_000);

describe("registry and visibility", () => {
  test("an editor creates a private, unchecked, unreviewed draft that anon and plain users cannot read", async () => {
    const id = await mkName();
    expect(await state(id)).toMatchObject({ status: "draft", visibility: "private_draft", integrity_status: "pending", scholarly_status: "not_reviewed", version: 1 });
    expect(await db.as(null, "select id from public.divine_names where id = $1", [id])).toHaveLength(0);
    expect(await db.as(plain, "select id from public.divine_names where id = $1", [id])).toHaveLength(0);
    expect(await db.as(editor, "select id from public.divine_names where id = $1", [id])).toHaveLength(1);
    expect((await sel("select created_by from public.divine_names where id = $1", [id]))[0]!.created_by).toBe(editor);
  });
  test("a plain user and anon cannot write; an editor cannot insert a public or published row", async () => {
    await rejects(mkName({}, plain), /row-level security/);
    await rejects(db.as(null, "insert into public.divine_names (slug, name_ar, name_ar_vowelled, transliteration) values ('anon-x', 'الله', 'الله', 'Allah')"), /permission denied/);
    await rejects(mkName({ visibility: "public_ai_draft" }), /row-level security|passed integrity/);
    await rejects(mkName({ status: "published" }), /row-level security|no review, no publish/);
  });
  test("the recognition status defaults to the stated educational methodology and cannot claim an enumeration", async () => {
    const id = await mkName();
    const [r] = await sel("select recognition_status, recognition_basis from public.divine_names where id = $1", [id]);
    expect(r).toEqual({ recognition_status: "educational_list", recognition_basis: "Educational list - enumeration not established by this platform" });
    await rejects(mkName({ recognition_status: "authentic_99" }), /check constraint/);
    await rejects(mkName({ recognition_basis: "Allah has only 99 names, exactly 99" }), /check constraint/);
  });
  test("bad shape is refused: slug, root, empty text", async () => {
    await rejects(mkName({ slug: "Bad Slug" }), /check constraint/);
    await rejects(mkName({ root: "xyz" }), /check constraint/);
    await rejects(mkName({ transliteration: "" }), /check constraint/);
    await mkName({ root: "غ-ف-ر" });
  });
});

describe("content guard in the database", () => {
  test.each([
    "Allah will surely answer anyone who calls this Name.",
    "This dua is guaranteed to be accepted.",
    "Reciting this Name earns you great reward.",
    "Recite it 100 times after every prayer.",
    "The best time to call upon this Name is the last third of the night.",
    "Allah has only 99 names.",
    "هذا الدعاء مضمون الإجابة",
    "اقرأه 100 مرة",
    "اسے 100 بار پڑھیں",
    "یہ دعا کبھی رد نہیں ہوتی",
  ])("refuses: %s", async (text) => {
    expect(checkAsmaText(text)).not.toEqual([]); // the TypeScript guard refuses it too
    await rejects(mkName({ rendering_en: text, rendering_ar: text, rendering_ur: text }), /check constraint/);
  });
  test("the SQL guard and the TypeScript guard agree on plain wording", async () => {
    for (const ok of ["Al-Ghafur: the Oft-Forgiving.", "كثير المغفرة والستر", "بہت بخشنے والا"]) {
      expect(checkAsmaText(ok)).toEqual([]);
      expect((await sel("select public.asma_text_ok($1) as ok", [ok]))[0]!.ok).toBe(true);
    }
  });
  test("a misconception may quote the claim to correct it, but its correction is guarded", async () => {
    const claim = "Some say it is guaranteed to be accepted if recited 100 times";
    await db.as(editor, "insert into public.divine_name_misconceptions (slug, claim_text) values ($1, $2)", [`mc-${++n}`, claim]);
    await rejects(db.as(editor, "insert into public.divine_name_misconceptions (slug, claim_text, correction_text) values ($1, $2, 'It is guaranteed to be accepted, surely')", [`mc-${++n}`, claim]), /check constraint/);
  });
});

describe("counts are computed, never typed", () => {
  test("no API role can write an occurrence or a summary directly", async () => {
    const id = await mkName();
    for (const who of [editor, admin, scholar]) {
      await rejects(db.as(who, "insert into public.divine_name_quran_occurrences (name_id, methodology_id, surah_id, ayah_no, token_index, measure, relation, matched_form, raw_word) values ($1, $2, 1, 1, 1, 'A', 'direct', 'x', 'x')", [id, methodology]), /permission denied/);
      await rejects(db.as(who, "insert into public.divine_name_count_summaries (name_id, methodology_id, measure, occurrence_count, verse_count, query_hash) values ($1, $2, 'A', 99, 1, $3)", [id, methodology, HASH]), /permission denied/);
    }
  });
  test("only an administrator (or the import job) computes occurrences", async () => {
    const id = await mkName();
    await rejects(db.as(editor, "select public.asma_replace_occurrences($1, $2, $3, '[]'::jsonb)", [id, methodology, HASH]), /only an administrator/);
    await rejects(db.as(null, "select public.asma_replace_occurrences($1, $2, $3, '[]'::jsonb)", [id, methodology, HASH]), /permission denied/);
  });
  test("summaries are derived from the rows: three separate measures, no total", async () => {
    const id = await mkName();
    const [r] = await compute(id, rows(3, 1, 2));
    expect((r as { asma_replace_occurrences: Record<string, number> }).asma_replace_occurrences).toEqual({ A: 3, B: 1, C: 2 });
    const s = await sel("select measure, occurrence_count, verse_count from public.divine_name_count_summaries where name_id = $1 order by measure", [id]);
    expect(s).toEqual([{ measure: "A", occurrence_count: 3, verse_count: 3 }, { measure: "B", occurrence_count: 1, verse_count: 1 }, { measure: "C", occurrence_count: 2, verse_count: 2 }]);
    expect((await sel("select public.asma_counts_consistent($1) as ok", [id]))[0]!.ok).toBe(true);
  });
  test("recomputing replaces the rows and the summary together; a bad row is refused", async () => {
    const id = await mkName();
    await compute(id, rows(5));
    await compute(id, rows(2));
    expect((await sel("select occurrence_count from public.divine_name_count_summaries where name_id = $1 and measure = 'A'", [id]))[0]!.occurrence_count).toBe(2);
    await rejects(compute(id, [{ surah: 1, ayah: 9, token: 1, measure: "A", relation: "direct", form: "x", raw: "x" }]), /foreign key|violates/);
    await rejects(compute(id, [{ surah: 1, ayah: 1, token: 1, measure: "C", relation: "direct", form: "x", raw: "x", root: "غ-ف-ر" }]), /check constraint/);
    await rejects(compute(id, [{ surah: 1, ayah: 1, token: 1, measure: "A", relation: "related", form: "x", raw: "x" }]), /check constraint/);
    await rejects(compute(id, [{ surah: 1, ayah: 1, token: 1, measure: "A", relation: "direct", form: "x", raw: "x", root: "غ-ف-ر" }]), /check constraint/);
  });
  test("a summary that no longer matches its rows makes the counts inconsistent (a hand edit is detected)", async () => {
    const id = await mkName();
    await compute(id, rows(2));
    await db.admin("update public.divine_name_count_summaries set occurrence_count = 99 where name_id = $1 and measure = 'A'", [id]);
    expect((await sel("select public.asma_counts_consistent($1) as ok", [id]))[0]!.ok).toBe(false);
  });
  test("a referent judgement is a scholarly reviewer's, applies to A and B only, and gates the reader hook", async () => {
    const id = await publishedName();
    const [a] = await sel("select id from public.divine_name_quran_occurrences where name_id = $1 and measure = 'A' order by token_index limit 1", [id]);
    const [c] = await sel("select id from public.divine_name_quran_occurrences where name_id = $1 and measure = 'C' limit 1", [id]);
    expect(await db.as(null, "select public.public_asma_names_in_verse(1::smallint, 1::smallint) as r")).toEqual([{ r: [] }]);
    await rejects(db.as(editor, "select public.asma_set_referent($1, 'confirmed_allah')", [a!.id]), /only a scholarly reviewer/);
    await rejects(db.as(scholar, "select public.asma_set_referent($1, 'confirmed_allah')", [c!.id]), /only A and B/);
    await db.as(scholar, "select public.asma_set_referent($1, 'confirmed_allah', 'fixture')", [a!.id]);
    const hook = (await db.as<{ r: Array<{ slug: string }> }>(null, "select public.public_asma_names_in_verse(1::smallint, 1::smallint) as r"))[0]!.r;
    expect(hook.length).toBeGreaterThan(0);
    const surah = (await db.as<{ r: Array<{ ayah: number; slug: string }> }>(null, "select public.public_asma_confirmed_in_surah(1::smallint) as r"))[0]!.r;
    expect(surah.some((x) => x.ayah === 1)).toBe(true);
    expect((await db.as<{ r: unknown[] }>(null, "select public.public_asma_confirmed_in_surah(2::smallint) as r"))[0]!.r).toEqual([]);
  });
});

describe("the AI-draft pathway", () => {
  test("integrity passes only for a complete, computed Name; 'passed' cannot be written directly", async () => {
    const bare = await mkName({ surface_forms: [], rendering_ur: null });
    const r = (await db.as<{ r: { passed: boolean; failures: string[] } }>(editor, "select public.run_asma_integrity('divine_name', $1) as r", [bare]))[0]!.r;
    expect(r.passed).toBe(false);
    expect(r.failures.join()).toMatch(/rendering is missing|surface form|counts are not computed/);
    await rejects(db.as(editor, "update public.divine_names set integrity_status = 'passed' where id = $1", [bare]), /only be marked passed by the automated check/);
    const ok = await mkName();
    await compute(ok);
    const r2 = (await db.as<{ r: { passed: boolean } }>(editor, "select public.run_asma_integrity('divine_name', $1) as r", [ok]))[0]!.r;
    expect(r2.passed).toBe(true);
    await rejects(db.as(plain, "select public.run_asma_integrity('divine_name', $1)", [ok]), /only an editor/);
  });
  test("a public AI draft is readable only through the functions, labelled, never as scholar-approved", async () => {
    const id = await mkName({ slug: `ai-public-${++n}` });
    await rejects(db.as(editor, "select public.publish_asma_ai_draft('divine_name', $1)", [id]), /passed integrity/);
    await compute(id);
    await db.as(editor, "select public.run_asma_integrity('divine_name', $1)", [id]);
    await db.as(editor, "select public.publish_asma_ai_draft('divine_name', $1)", [id]);
    expect(await state(id)).toMatchObject({ visibility: "public_ai_draft", scholarly_status: "not_reviewed", status: "draft" });
    expect(await db.as(null, "select id from public.divine_names where id = $1", [id])).toHaveLength(0); // the table stays closed
    const list = (await db.as<{ r: Array<Record<string, unknown>> }>(null, "select public.public_asma_names() as r"))[0]!.r;
    const mine = list.find((x) => x.scholarly_status === "not_reviewed" && x.published === false);
    expect(mine).toMatchObject({ ai_generated: true, scholarly_status: "not_reviewed", published: false });
    const slug = (await sel("select slug from public.divine_names where id = $1", [id]))[0]!.slug as string;
    const doc = (await db.as<{ r: { summary: { measures: Record<string, { count: number; verses: number }>; edition: { sha256: string } } } }>(null, "select public.public_asma_name($1) as r", [slug]))[0]!.r;
    expect(doc.summary.measures).toMatchObject({ A: { count: 3, verses: 3 }, B: { count: 1 }, C: { count: 2 } });
    expect(doc.summary.edition.sha256).toBe(HASH);
    expect(JSON.stringify(doc)).not.toMatch(/"total"/);
    const A = (await db.as<{ r: { total: number; rows: Array<{ relation: string }> } }>(null, "select public.public_asma_occurrences($1, 'A') as r", [slug]))[0]!.r;
    const C = (await db.as<{ r: { total: number; rows: Array<{ relation: string; root: string }> } }>(null, "select public.public_asma_occurrences($1, 'C') as r", [slug]))[0]!.r;
    expect(A.total).toBe(3);
    expect(A.rows.every((x) => x.relation === "direct")).toBe(true);
    expect(C.total).toBe(2);
    expect(C.rows.every((x) => x.relation === "related" && x.root === "غ-ف-ر")).toBe(true);
    expect((await db.as<{ r: unknown }>(null, "select public.public_asma_occurrences('no-such', 'A') as r"))[0]!.r).toBeNull();
    expect((await db.as<{ r: unknown }>(null, "select public.public_asma_occurrences($1, 'Z') as r", [slug]))[0]!.r).toBeNull();
  });
  test("editing a public AI draft sends it back to private and pending", async () => {
    const id = await mkName();
    await compute(id);
    await db.as(editor, "select public.run_asma_integrity('divine_name', $1)", [id]);
    await db.as(editor, "select public.publish_asma_ai_draft('divine_name', $1)", [id]);
    await db.as(editor, "update public.divine_names set rendering_en = 'An edited fixture gloss' where id = $1", [id]);
    expect(await state(id)).toMatchObject({ visibility: "private_draft", integrity_status: "pending", version: 2 });
  });
  test("a non-AI record cannot use the AI-draft pathway; withdrawing hides it again", async () => {
    const human = await mkName({ ai_generated: false });
    await compute(human);
    await db.as(editor, "select public.run_asma_integrity('divine_name', $1)", [human]);
    await rejects(db.as(editor, "select public.publish_asma_ai_draft('divine_name', $1)", [human]), /only AI-authored text/);
    const ai = await mkName();
    await compute(ai);
    await db.as(editor, "select public.run_asma_integrity('divine_name', $1)", [ai]);
    await db.as(editor, "select public.publish_asma_ai_draft('divine_name', $1)", [ai]);
    await db.as(editor, "select public.withdraw_asma_ai_draft('divine_name', $1)", [ai]);
    expect((await state(ai)).visibility).toBe("private_draft");
  });
});

describe("publication: a version-bound scholarly review AND the passed check", () => {
  test("publishing needs the review of THIS version, the integrity check and derived counts", async () => {
    const id = await mkName();
    await rejects(db.as(editor, "update public.divine_names set status = 'published' where id = $1", [id]), /no review, no publish/);
    await compute(id);
    await review(scholar, "divine_name", id);
    await rejects(db.as(editor, "update public.divine_names set status = 'published' where id = $1", [id]), /no integrity, no publish/);
    await db.as(editor, "select public.run_asma_integrity('divine_name', $1)", [id]);
    await db.as(editor, "update public.divine_names set status = 'published' where id = $1", [id]);
    expect(await state(id)).toMatchObject({ status: "published", visibility: "public_approved", scholarly_status: "approved" });
    expect(await db.as(null, "select id from public.divine_names where id = $1", [id])).toHaveLength(1);
  });
  test("an edit after approval makes the approval stale: the next publish needs a new review", async () => {
    const id = await mkName();
    await compute(id);
    await review(scholar, "divine_name", id);
    await db.as(editor, "update public.divine_names set rendering_en = 'Edited after approval' where id = $1", [id]);
    expect((await state(id)).scholarly_status).toBe("invalidated");
    await db.as(editor, "select public.run_asma_integrity('divine_name', $1)", [id]);
    await rejects(db.as(editor, "update public.divine_names set status = 'published' where id = $1", [id]), /no review, no publish/);
    await review(scholar, "divine_name", id);
    await db.as(editor, "update public.divine_names set status = 'published' where id = $1", [id]);
  });
  test("no self-review, no review by a non-reviewer, and the version is captured by the database", async () => {
    const id = await mkName({}, both);
    await rejects(review(both, "divine_name", id), /cannot review their own/);
    await rejects(review(editor, "divine_name", id), /row-level security|only a scholarly reviewer/);
    await rejects(review(plain, "divine_name", id), /row-level security|only a scholarly reviewer/);
    await review(scholar, "divine_name", id, "changes_requested");
    expect((await state(id)).scholarly_status).toBe("changes_requested");
    const [r] = await sel("select entity_version from public.divine_name_reviews where entity_id = $1", [id]);
    expect(r!.entity_version).toBe(1);
    await rejects(db.as(editor, "update public.divine_names set scholarly_status = 'approved' where id = $1", [id]), /scholarly approval needs/);
  });
  test("a rejected review blocks publication; a published Name is fixed until moved to correction", async () => {
    const id = await publishedName();
    await rejects(db.as(editor, "update public.divine_names set rendering_en = 'Edit in place' where id = $1", [id]), /fixed: move it to correction/);
    await rejects(db.as(editor, "insert into public.divine_name_aliases (name_id, alias, language, kind) values ($1, 'x', 'en', 'spelling')", [id]), /fixed: move it to correction/);
    await db.as(editor, "update public.divine_names set status = 'correction' where id = $1", [id]);
    expect((await state(id)).visibility).toBe("private_draft");
    expect(await db.as(null, "select id from public.divine_names where id = $1", [id])).toHaveLength(0);
    await db.as(editor, "update public.divine_names set rendering_en = 'Corrected gloss' where id = $1", [id]);
    await db.as(editor, "insert into public.divine_name_aliases (name_id, alias, language, kind) values ($1, 'x', 'en', 'spelling')", [id]);
  });
  test("a published record cannot be deleted by an editor; an admin deletes only unpublished ones", async () => {
    const id = await publishedName();
    await db.as(editor, "delete from public.divine_names where id = $1", [id]);
    await db.as(admin, "delete from public.divine_names where id = $1", [id]);
    expect(await sel("select 1 from public.divine_names where id = $1", [id])).toHaveLength(1);
  });
});

describe("re-review when the classification or the methodology changes", () => {
  test("changing the registered surface forms flags the Name and its dependents and takes them off the public page", async () => {
    const id = await publishedName();
    const [pos] = await db.as<{ id: string }>(editor, "insert into public.divine_name_scholarly_positions (name_id, topic) values ($1, 'enumeration') returning id", [id]);
    const [mis] = await db.as<{ id: string }>(editor, "insert into public.divine_name_misconceptions (name_id, slug, claim_text) values ($1, $2, 'A claim people make') returning id", [id, `mc-${++n}`]);
    await db.as(editor, "update public.divine_names set status = 'correction' where id = $1", [id]);
    await db.as(editor, "update public.divine_names set surface_forms = array['الغفور', 'غفور'] where id = $1", [id]);
    expect(await state(id)).toMatchObject({ classification_version: 2, needs_rereview: true, visibility: "private_draft" });
    const flagged = await sel("select needs_rereview from public.divine_name_scholarly_positions where id = $1 union all select needs_rereview from public.divine_name_misconceptions where id = $2", [pos!.id, mis!.id]);
    expect(flagged).toEqual([{ needs_rereview: true }, { needs_rereview: true }]);
    expect((await sel("select stale from public.divine_name_count_summaries where name_id = $1", [id])).every((r) => r.stale === true)).toBe(true);
    // publishing again needs fresh computation AND a fresh review AND the flag cleared by it
    await rejects(db.as(editor, "update public.divine_names set status = 'published' where id = $1", [id]), /no review, no publish/);
    await compute(id);
    await db.as(editor, "select public.run_asma_integrity('divine_name', $1)", [id]);
    await review(scholar, "divine_name", id);
    await rejects(db.as(editor, "update public.divine_names set status = 'published' where id = $1", [id]), /flagged for re-review/);
    await db.as(editor, "update public.divine_names set needs_rereview = false where id = $1", [id]);
    await db.as(editor, "update public.divine_names set status = 'published' where id = $1", [id]);
  });
  test("changing the recognition status or the root is a classification change", async () => {
    const id = await mkName();
    await db.as(editor, "update public.divine_names set recognition_status = 'disputed_candidate' where id = $1", [id]);
    await db.as(editor, "update public.divine_names set root = 'غ-ف-ر' where id = $1", [id]);
    expect((await state(id)).classification_version).toBe(3);
  });
  test("a published child sent to correction by a flag leaves the public record, and its review must be renewed", async () => {
    const id = await publishedName();
    const [pos] = await db.as<{ id: string }>(editor, "insert into public.divine_name_scholarly_positions (name_id, topic, scholar_name, work_title, locator, position_summary, evidence_status) values ($1, 'meaning', 'Fixture Scholar', 'Fixture Work', 'p. 1', '[fixture] an attributed position summary', 'sourced') returning id", [id]);
    await review(scholar, "divine_name_scholarly_position", pos!.id);
    await db.as(editor, "update public.divine_name_scholarly_positions set status = 'published' where id = $1", [pos!.id]);
    expect((await db.as(null, "select id from public.divine_name_scholarly_positions where id = $1", [pos!.id]))).toHaveLength(1);
    await db.as(editor, "update public.divine_names set status = 'correction' where id = $1", [id]);
    await db.as(editor, "update public.divine_names set root = 'غ-ف-ر' where id = $1", [id]);
    expect((await sel("select status, needs_rereview from public.divine_name_scholarly_positions where id = $1", [pos!.id]))[0]).toEqual({ status: "correction", needs_rereview: true });
    expect(await db.as(null, "select id from public.divine_name_scholarly_positions where id = $1", [pos!.id])).toHaveLength(0);
  });
  test("measures B and C come only from published, sourced, reviewed inclusion rows; publishing one sends the Name back for re-review", async () => {
    const id = await publishedName();
    const ins = (cols: string, vals: unknown[]) => db.as<{ id: string }>(editor, `insert into public.divine_name_inclusions (name_id, ${cols}) values ($1, ${vals.map((_, i) => `$${i + 2}`).join(",")}) returning id`, [id, ...vals]);
    await rejects(ins("measure, form, basis", ["C", "غفران", "[fixture] a related-root form"]), /check constraint/); // C needs its root
    await rejects(ins("measure, form, basis, root", ["B", "للغفور", "[fixture] a prefixed form", "غ-ف-ر"]), /check constraint/); // B has no root
    await rejects(ins("measure, form, basis, evidence_status", ["B", "للغفور", "[fixture] a prefixed form", "sourced"]), /check constraint/); // sourced needs a source
    const [placeholder] = await ins("measure, form, basis", ["B", "للغفور", "[fixture] a prefixed form"]);
    await review(scholar, "divine_name_inclusion", placeholder!.id);
    await rejects(db.as(editor, "update public.divine_name_inclusions set status = 'published' where id = $1", [placeholder!.id]), /needs source" placeholder is never published/);
    const [inc] = await ins("measure, form, root, basis, source_id, evidence_status", ["C", "غفران", "غ-ف-ر", "[fixture] a related-root form a reviewer listed", srcId, "sourced"]);
    await rejects(db.as(editor, "update public.divine_name_inclusions set status = 'published' where id = $1", [inc!.id]), /no review, no publish/);
    expect(await sel("select 1 from public.divine_name_inclusions where status = 'published' and name_id = $1", [id])).toHaveLength(0);
    await review(scholar, "divine_name_inclusion", inc!.id);
    await db.as(editor, "update public.divine_name_inclusions set status = 'published' where id = $1", [inc!.id]);
    expect(await state(id)).toMatchObject({ status: "correction", classification_version: 2, needs_rereview: true, visibility: "private_draft" });
    expect((await sel("select stale from public.divine_name_count_summaries where name_id = $1", [id])).every((r) => r.stale === true)).toBe(true);
    await rejects(db.as(editor, "update public.divine_name_inclusions set basis = '[fixture] edited in place after publication' where id = $1", [inc!.id]), /fixed: move it to correction/);
  });
  test("a new current counting methodology sends every Name back for re-review", async () => {
    const db2 = await createDb({ supabaseDefaults: true });
    const ed = await db2.createUser("e@test.local", ["editor"]);
    const adm = await db2.createUser("a@test.local", ["admin"]);
    await db2.as(ed, "insert into public.divine_names (slug, name_ar, name_ar_vowelled, transliteration) values ('m-one', 'الله', 'الله', 'Allah')");
    await db2.as(adm, "insert into public.divine_name_occurrence_methodologies (version, normalisation_policy, tokenisation_policy, query_version, edition_source, edition_version, edition_sha256, edition_content_sha256, description, is_current) values ('m1-fx', 'a', 'b', 'c', 'S', '1', $1, $1, 'The first fixture methodology', true)", [HASH]);
    expect((await db2.admin<{ needs_rereview: boolean }>("select needs_rereview from public.divine_names"))[0]!.needs_rereview).toBe(true);
    await rejects(db2.as(adm, "insert into public.divine_name_occurrence_methodologies (version, normalisation_policy, tokenisation_policy, query_version, edition_source, edition_version, edition_sha256, edition_content_sha256, description, is_current) values ('m2-fx', 'a', 'b', 'c', 'S', '2', $1, $1, 'A second current methodology', true)", [HASH]), /duplicate key/);
    await rejects(db2.as(ed, "insert into public.divine_name_occurrence_methodologies (version, normalisation_policy, tokenisation_policy, query_version, edition_source, edition_version, edition_sha256, edition_content_sha256, description) values ('m3-fx', 'a', 'b', 'c', 'S', '3', $1, $1, 'Not an administrator')", [HASH]), /row-level security/);
  }, 120_000);
});

describe("evidence rows are references, never text", () => {
  const ev = (who: string, cols: Record<string, unknown>) => {
    const k = Object.keys(cols);
    return db.as<{ id: string }>(who, `insert into public.divine_name_hadith_evidence (${k.join(",")}) values (${k.map((_, i) => `$${i + 1}`).join(",")}) returning id`, Object.values(cols));
  };
  test("a placeholder is 'needs_source' with no record; a sourced row needs a record AND a grading", async () => {
    const id = await mkName();
    await ev(editor, { name_id: id, purpose: "enumeration", reference_label: "Sahih al-Bukhari (number to be supplied by a reviewer)" });
    await rejects(ev(editor, { name_id: id, purpose: "enumeration", evidence_status: "sourced" }), /check constraint/);
    await rejects(ev(editor, { name_id: id, purpose: "enumeration", evidence_status: "sourced", hadith_id: hBukhari }), /check constraint/);
    await rejects(ev(editor, { name_id: id, purpose: "enumeration", hadith_id: hBukhari, hadith_grading_id: hBukhariGrade }), /check constraint/);
    await ev(editor, { name_id: id, purpose: "enumeration", evidence_status: "sourced", hadith_id: hBukhari, hadith_grading_id: hBukhariGrade });
  });
  test("only Bukhari, Muslim and individually graded sahih Tirmidhi / Ibn Majah narrations; the grading must belong to the narration", async () => {
    const id = await mkName();
    const s = (h: string, g: string) => ev(editor, { name_id: id, purpose: "attribute", evidence_status: "sourced", hadith_id: h, hadith_grading_id: g });
    await rejects(s(hAbuDawud, hAbuDawudGrade), /only from Bukhari, Muslim/);
    await rejects(s(hTirmidhiHasan, hTirmidhiHasanGrade), /only from Bukhari, Muslim/);
    await s(hTirmidhiSahih, hTirmidhiSahihGrade);
    await rejects(s(hBukhari, hTirmidhiSahihGrade), /does not belong/);
  });
  test("a placeholder is never published as content, and the public page reports status only", async () => {
    const id = await publishedName();
    const [e] = await ev(editor, { name_id: id, purpose: "enumeration", reference_label: "Sahih al-Bukhari (to be completed by a reviewer)" });
    await review(scholar, "divine_name_hadith_evidence", e!.id);
    await rejects(db.as(editor, "update public.divine_name_hadith_evidence set status = 'published' where id = $1", [e!.id]), /needs source" placeholder is never published/);
    const [real] = await ev(editor, { name_id: id, purpose: "attribute", evidence_status: "sourced", hadith_id: hBukhari, hadith_grading_id: hBukhariGrade });
    await rejects(db.as(editor, "update public.divine_name_hadith_evidence set status = 'published' where id = $1", [real!.id]), /no review, no publish/);
    await review(scholar, "divine_name_hadith_evidence", real!.id);
    await db.as(editor, "update public.divine_name_hadith_evidence set status = 'published' where id = $1", [real!.id]);
    const doc = (await db.as<{ r: { hadith_evidence: Array<Record<string, unknown>> } }>(null, "select public.public_asma_name((select slug from public.divine_names where id = $1)) as r", [id]))[0]!.r;
    expect(doc.hadith_evidence).toHaveLength(2);
    expect(doc.hadith_evidence.find((x) => x.evidence_status === "needs_source")).toMatchObject({ collection: null, grading: null });
    expect(doc.hadith_evidence.find((x) => x.evidence_status === "sourced")).toMatchObject({ collection: "bukhari", number: "1" });
    expect(JSON.stringify(doc)).not.toContain(FIXTURE); // no narration text leaves the function
  });
  test("scholarly positions are attributed, sourced to be published and never scored", async () => {
    const id = await mkName();
    const pos = (cols: string, vals: unknown[]) => db.as(editor, `insert into public.divine_name_scholarly_positions (name_id, topic, ${cols}) values ($1, 'enumeration', ${vals.map((_, i) => `$${i + 2}`).join(",")})`, [id, ...vals]);
    await db.as(editor, "insert into public.divine_name_scholarly_positions (name_id, topic) values ($1, 'enumeration')", [id]);
    await rejects(pos("evidence_status", ["sourced"]), /check constraint/);
    await rejects(pos("scholar_name, work_title, locator, position_summary", ["Fixture", "Work", "p. 1", "[fixture] this view is 80% more likely"]), /check constraint/);
    await rejects(pos("scholar_name, work_title, locator, position_summary", ["Fixture", "Work", "p. 1", "[fixture] the highest ranking position among scholars"]), /check constraint/);
    const cols = await sel("select column_name, data_type from information_schema.columns where table_name = 'divine_name_scholarly_positions' and data_type in ('integer', 'numeric', 'double precision', 'real')");
    expect(cols.map((c) => c.column_name)).toEqual(["version"]);
  });
  test("a relationship needs a verse that exists to be sourced, and a Name is not related to itself", async () => {
    const a = await mkName();
    const b = await mkName();
    await rejects(db.as(editor, "insert into public.divine_name_relationships (name_id, related_name_id, kind) values ($1, $1, 'frequently_paired')", [a]), /check constraint/);
    await rejects(db.as(editor, "insert into public.divine_name_relationships (name_id, related_name_id, kind, evidence_status) values ($1, $2, 'frequently_paired', 'sourced')", [a, b]), /check constraint/);
    await rejects(db.as(editor, "insert into public.divine_name_relationships (name_id, related_name_id, kind, evidence_status, surah_id, ayah_no) values ($1, $2, 'frequently_paired', 'sourced', 1, 99)", [a, b]), /foreign key/);
    await db.as(editor, "insert into public.divine_name_relationships (name_id, related_name_id, kind, evidence_status, surah_id, ayah_no) values ($1, $2, 'frequently_paired', 'sourced', 1, 3)", [a, b]);
  });
});

describe("duas: references and labelled personal wording", () => {
  const dua = (cols: Record<string, unknown>) => {
    const f = { slug: `dua-${++n}`, ai_generated: true, ...cols };
    const k = Object.keys(f);
    return db.as<{ id: string; slug: string }>(editor, `insert into public.authentic_duas (${k.join(",")}) values (${k.map((_, i) => `$${i + 1}`).join(",")}) returning id, slug`, Object.values(f));
  };
  test("category A holds a reference to an existing verse or graded hadith, never wording", async () => {
    await dua({ category: "A", surah_id: 2, ayah_from: 255, evidence_status: "sourced", title_en: "Fixture", title_ar: "تجربة", title_ur: "تجربہ" });
    await dua({ category: "A", hadith_id: hBukhari, hadith_grading_id: hBukhariGrade, evidence_status: "sourced" });
    await dua({ category: "A", reference_label: "Source to be supplied by a reviewer" });
    await rejects(dua({ category: "A", surah_id: 2, ayah_from: 999, evidence_status: "sourced" }), /foreign key/);
    await rejects(dua({ category: "A", personal_wording: "Some wording of my own", wording_label: LABEL }), /check constraint/);
    await rejects(dua({ category: "A", evidence_status: "sourced" }), /check constraint/);
    await rejects(dua({ category: "A", surah_id: 2, ayah_from: 255, hadith_id: hBukhari, hadith_grading_id: hBukhariGrade, evidence_status: "sourced" }), /check constraint/);
  });
  test("category B carries the exact label and no source; the wording is guarded", async () => {
    await dua({ category: "B", personal_wording: "O Allah, I ask You for guidance in my work.", wording_label: LABEL });
    await rejects(dua({ category: "B", personal_wording: "O Allah, guide me." }), /check constraint/);
    await rejects(dua({ category: "B", personal_wording: "O Allah, guide me.", wording_label: "A dua from the Prophet" }), /check constraint/);
    await rejects(dua({ category: "B", personal_wording: "O Allah, guide me.", wording_label: LABEL, surah_id: 2, ayah_from: 255 }), /check constraint/);
    await rejects(dua({ category: "B", personal_wording: "Say this 100 times and it is guaranteed to be accepted", wording_label: LABEL }), /check constraint/);
  });
  test("a dua becomes a public AI draft through the same gate and is read through the functions", async () => {
    const [d] = await dua({ category: "B", personal_wording: "O Allah, I ask You for guidance in my work.", wording_label: LABEL, title_en: "Guidance", title_ar: "هداية", title_ur: "ہدایت" });
    const [bad] = await dua({ category: "B", personal_wording: "O Allah, I ask for ease.", wording_label: LABEL });
    expect(((await db.as<{ r: { passed: boolean } }>(editor, "select public.run_asma_integrity('authentic_dua', $1) as r", [bad!.id]))[0]!.r).passed).toBe(false);
    await db.as(editor, "select public.run_asma_integrity('authentic_dua', $1)", [d!.id]);
    await db.as(editor, "select public.publish_asma_ai_draft('authentic_dua', $1)", [d!.id]);
    expect(await db.as(null, "select id from public.authentic_duas where id = $1", [d!.id])).toHaveLength(0);
    const one = (await db.as<{ r: Record<string, unknown> }>(null, "select public.public_asma_dua($1) as r", [d!.slug]))[0]!.r;
    expect(one).toMatchObject({ category: "B", wording_label: LABEL, scholarly_status: "not_reviewed", published: false });
    expect((await db.as<{ r: Array<{ slug: string }> }>(null, "select public.public_asma_duas() as r"))[0]!.r.map((x) => x.slug)).toContain(d!.slug);
    expect((await db.as<{ r: unknown }>(null, "select public.public_asma_dua($1) as r", [bad!.slug]))[0]!.r).toBeNull();
  });
  test("life topics: a link to a Name needs a verse that exists to be sourced; topics are public only as checked AI drafts", async () => {
    const [t] = await db.as<{ id: string; slug: string }>(editor, "insert into public.dua_life_topics (slug, title_en, title_ar, title_ur, ai_generated) values ($1, 'Forgiveness', 'المغفرة', 'مغفرت', true) returning id, slug", [`topic-${++n}`]);
    const id = await publishedName();
    await rejects(db.as(editor, "insert into public.divine_name_topic_links (topic_id, name_id, evidence_status) values ($1, $2, 'sourced')", [t!.id, id]), /check constraint/);
    await db.as(editor, "insert into public.divine_name_topic_links (topic_id, name_id, surah_id, ayah_no, evidence_status, basis) values ($1, $2, 1, 3, 'sourced', 'the verse contains the Name (computed)')", [t!.id, id]);
    expect(((await db.as<{ r: unknown[] }>(null, "select public.public_asma_topics() as r"))[0]!.r)).toEqual([]);
    await db.as(editor, "select public.run_asma_integrity('dua_life_topic', $1)", [t!.id]);
    await db.as(editor, "select public.publish_asma_ai_draft('dua_life_topic', $1)", [t!.id]);
    const topics = (await db.as<{ r: Array<{ slug: string; names: unknown[] }> }>(null, "select public.public_asma_topics() as r"))[0]!.r;
    expect(topics.find((x) => x.slug === t!.slug)!.names).toHaveLength(1);
  });
});

describe("private learning", () => {
  test("a user reads and writes only their own rows, only for visible Names, and anon has no access", async () => {
    const visible = await publishedName();
    const hidden = await mkName();
    await db.as(plain, "insert into public.user_divine_name_learning (name_id, saved, note) values ($1, true, 'my private note')", [visible]);
    await rejects(db.as(plain, "insert into public.user_divine_name_learning (name_id, saved) values ($1, true)", [hidden]), /row-level security/);
    await rejects(db.as(plain, "insert into public.user_divine_name_learning (user_id, name_id) values ($1, $2)", [other, visible]), /row-level security/);
    expect(await db.as(other, "select * from public.user_divine_name_learning")).toHaveLength(0);
    expect(await db.as(plain, "select * from public.user_divine_name_learning")).toHaveLength(1);
    await rejects(db.as(null, "select * from public.user_divine_name_learning"), /permission denied/);
    await db.as(plain, "update public.user_divine_name_learning set box = 2, times_seen = 3, times_recalled = 2, due_at = now() where name_id = $1", [visible]);
    await rejects(db.as(plain, "update public.user_divine_name_learning set times_recalled = 9 where name_id = $1", [visible]), /check constraint/);
    await db.as(other, "delete from public.user_divine_name_learning");
    expect(await db.as(plain, "select * from public.user_divine_name_learning")).toHaveLength(1);
    expect(await sel("select column_name from information_schema.columns where table_name = 'user_divine_name_learning' and column_name ~* '(reward|points|score|hasanat)'")).toEqual([]);
  });
  test("dua bookmarks are private and need a visible dua", async () => {
    const [d] = await db.as<{ id: string }>(editor, "insert into public.authentic_duas (slug, category, personal_wording, wording_label, title_en, title_ar, title_ur, ai_generated) values ($1, 'B', 'O Allah, I ask for ease.', $2, 'Ease', 'يسر', 'آسانی', true) returning id", [`dua-${++n}`, LABEL]);
    await rejects(db.as(plain, "insert into public.user_dua_bookmarks (dua_id) values ($1)", [d!.id]), /row-level security/);
    await db.as(editor, "select public.run_asma_integrity('authentic_dua', $1)", [d!.id]);
    await db.as(editor, "select public.publish_asma_ai_draft('authentic_dua', $1)", [d!.id]);
    await db.as(plain, "insert into public.user_dua_bookmarks (dua_id, note) values ($1, 'mine')", [d!.id]);
    expect(await db.as(other, "select * from public.user_dua_bookmarks")).toHaveLength(0);
  });
});
