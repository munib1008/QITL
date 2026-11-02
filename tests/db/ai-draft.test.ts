// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * The AI-draft pathway (20261031002700): three separate states, a deterministic integrity gate, a public read API that
 * is the only way an anonymous reader sees an AI draft, and no way to reach "scholar approved" without a real review.
 * Fixture text is a labelled placeholder, never Quran or hadith text.
 */
const FIXTURE = "[TEST FIXTURE — placeholder, not Quran or hadith text]";
let db: Db;
let editor: string, reviewer: string, plain: string;
let seq = 0;

async function build(opts: { refs?: boolean; badAyah?: boolean; ai?: boolean } = {}): Promise<{ story: string; slug: string; chapter: string; claim: string }> {
  const { refs = true, badAyah = false, ai = true } = opts;
  const slug = `ai-fx-${++seq}`;
  const [s] = await db.as<{ id: string }>(editor, "insert into public.stories (slug, title, summary, ai_generated, ai_model, prompt_version) values ($1, 'Fixture story', 'A fixture summary', $2, 'test-model', 'v1') returning id", [slug, ai]);
  const [c] = await db.as<{ id: string }>(editor, "insert into public.chapters (story_id, position, title, body_md) values ($1, 1, 'Fixture chapter', $2) returning id", [s!.id, `${FIXTURE} a chapter body long enough to count as text [c1]`]);
  const [cl] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ('Fixture claim', 'quran', $1) returning id", [editor]);
  if (refs) await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 12, $2)", [cl!.id, badAyah ? 99 : 3]);
  await db.as(editor, "insert into public.chapter_claims (chapter_id, claim_id, anchor) values ($1, $2, 'c1')", [c!.id, cl!.id]);
  return { story: s!.id, slug, chapter: c!.id, claim: cl!.id };
}
const state = async (id: string) => (await db.admin<{ visibility: string; integrity_status: string; scholarly_status: string; status: string }>("select visibility, integrity_status, scholarly_status, status from public.stories where id = $1", [id]))[0]!;

beforeAll(async () => {
  db = await createDb({ supabaseDefaults: true });
  editor = await db.createUser("editor@test.local", ["editor"]);
  reviewer = await db.createUser("reviewer@test.local", ["scholarly_reviewer"]);
  plain = await db.createUser("plain@test.local");
  const [{ id: src }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id")) as [{ id: string }];
  const [{ id: ver }] = (await db.admin<{ id: string }>("insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id", [src])) as [{ id: string }];
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (12, 'x', 'Fixture', 111, $1)", [ver]);
  for (let a = 1; a <= 9; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (12, $1, $2, $3)", [a, FIXTURE, ver]);
}, 240_000);

describe("AI-draft pathway", () => {
  test("a new story is private, unchecked and not reviewed: three separate facts", async () => {
    const { story } = await build();
    expect(await state(story)).toMatchObject({ visibility: "private_draft", integrity_status: "pending", scholarly_status: "not_reviewed", status: "draft" });
  });

  test("integrity cannot be set to passed by hand, only by the automated check", async () => {
    const { story } = await build();
    await rejects(db.as(editor, "update public.stories set integrity_status = 'passed' where id = $1", [story]), /automated check/);
    const r = await db.as<{ status: string }>(editor, "select (public.run_ai_draft_integrity($1)) ->> 'status' as status", [story]);
    expect(r[0]!.status).toBe("passed");
    expect((await state(story)).integrity_status).toBe("passed");
  });

  test("a story with an uncited claim or a verse that does not exist fails the check and cannot go public", async () => {
    const noRef = await build({ refs: false });
    expect((await db.as<{ status: string }>(editor, "select (public.run_ai_draft_integrity($1)) ->> 'status' as status", [noRef.story]))[0]!.status).toBe("failed");
    await rejects(db.as(editor, "select public.publish_ai_draft($1)", [noRef.story]), /passed source-integrity/);
    // a verse that does not exist cannot even be cited: the database refuses it before the integrity check is needed.
    await rejects(build({ badAyah: true }), /foreign key/);
  });

  test("a passed AI draft is readable by an anonymous visitor only through the public functions, and only once published as a draft", async () => {
    const { story, slug } = await build();
    await db.as(editor, "select public.run_ai_draft_integrity($1)", [story]);
    expect(await db.as(null, "select public.public_ai_draft($1) as d", [slug])).toEqual([{ d: null }]);
    await db.as(editor, "select public.publish_ai_draft($1)", [story]);
    const [row] = await db.as<{ d: { scholarly_status: string; chapters: { claims: { refs: unknown[] }[] }[] } }>(null, "select public.public_ai_draft($1) as d", [slug]);
    expect(row!.d.scholarly_status).toBe("not_reviewed");
    expect(row!.d.chapters[0]!.claims[0]!.refs).toHaveLength(1);
    const list = await db.as<{ l: { slug: string }[] }>(null, "select public.public_ai_drafts() as l");
    expect(list[0]!.l.map((x) => x.slug)).toContain(slug);
    // the tables themselves stay closed: an anonymous reader still sees no draft row.
    expect(await db.as(null, "select id from public.stories where id = $1", [story])).toHaveLength(0);
    expect(await db.as(null, "select id from public.chapters where story_id = $1", [story])).toHaveLength(0);
  });

  test("a story that is not AI-authored cannot use the AI-draft pathway", async () => {
    const { story } = await build({ ai: false });
    await db.as(editor, "select public.run_ai_draft_integrity($1)", [story]);
    await rejects(db.as(editor, "select public.publish_ai_draft($1)", [story]), /AI-authored/);
  });

  test("a visitor or reviewer-only account cannot run the check, publish or withdraw", async () => {
    const { story } = await build();
    await rejects(db.as(plain, "select public.run_ai_draft_integrity($1)", [story]), /editor or administrator/);
    await rejects(db.as(reviewer, "select public.publish_ai_draft($1)", [story]), /editor or administrator/);
    await rejects(db.as(null, "select public.withdraw_ai_draft($1)", [story]), /permission denied|editor or administrator/);
  });

  test("an AI draft can never be marked scholar-approved or published without a real approving review", async () => {
    const { story } = await build();
    await db.as(editor, "select public.run_ai_draft_integrity($1)", [story]);
    await db.as(editor, "select public.publish_ai_draft($1)", [story]);
    await rejects(db.as(editor, "update public.stories set scholarly_status = 'approved' where id = $1", [story]), /approving editorial review/);
    await rejects(db.as(editor, "update public.stories set status = 'published' where id = $1", [story]), /./);
    await rejects(db.as(editor, "update public.stories set visibility = 'public_approved' where id = $1", [story]), /./);
    expect((await state(story)).scholarly_status).toBe("not_reviewed");
  });

  test("editing a public AI draft sends it back to private and unchecked until the check runs again", async () => {
    const { story, slug, chapter } = await build();
    await db.as(editor, "select public.run_ai_draft_integrity($1)", [story]);
    await db.as(editor, "select public.publish_ai_draft($1)", [story]);
    await db.as(editor, "update public.chapters set body_md = $2 where id = $1", [chapter, `${FIXTURE} an edited chapter body, still long enough [c1]`]);
    expect(await state(story)).toMatchObject({ visibility: "private_draft", integrity_status: "pending" });
    expect(await db.as(null, "select public.public_ai_draft($1) as d", [slug])).toEqual([{ d: null }]);
  });

  test("a rejected draft is not public, and withdrawing makes it private again", async () => {
    const { story, slug } = await build();
    await db.as(editor, "select public.run_ai_draft_integrity($1)", [story]);
    await db.as(editor, "select public.publish_ai_draft($1)", [story]);
    await db.as(editor, "select public.withdraw_ai_draft($1)", [story]);
    expect((await state(story)).visibility).toBe("private_draft");
    expect(await db.as(null, "select public.public_ai_draft($1) as d", [slug])).toEqual([{ d: null }]);
  });
});
