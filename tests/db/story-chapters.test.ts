// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";
import { runChecks, type DbInputs } from "../../src/lib/stories/checks";

/**
 * Story chapters (gap 3), source-change invalidation (gap 5), the coverage functions (gap 4) and the automated checks
 * on real rows (gap 7). Fixture text is a labelled placeholder, never Quran or hadith text.
 */
const FIXTURE = "[TEST FIXTURE — placeholder, not Quran or hadith text]";

let db: Db;
let editor: string, reviewer: string, both: string, plain: string, admin: string;
let sourceId: string, versionId: string;
let seq = 0;

async function newClaim(statement = `Fixture claim ${++seq} behind a chapter`, who = editor): Promise<string> {
  const [r] = await db.as<{ id: string }>(who, "insert into public.evidence_claims (statement, evidence, created_by) values ($1, 'quran', $2) returning id", [statement, who]);
  return r!.id;
}
async function approveClaim(id: string, from = 3, to: number | null = null) {
  await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from, quran_ayah_to) values ($1, 'quran', 12, $2, $3)", [id, from, to]);
  await db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [id, reviewer]);
  await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [id]);
}
const review = (type: string, id: string, decision = "approved") =>
  db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ($1, $2, $3, $4)", [type, id, reviewer, decision]);
async function newStory(): Promise<string> {
  const [s] = await db.as<{ id: string }>(editor, "insert into public.stories (slug, title, summary) values ($1, 'Fixture story', 'A fixture summary') returning id", [`fx-story-${++seq}`]);
  return s!.id;
}
async function newChapter(story: string, position = 1, extra = ""): Promise<string> {
  const [c] = await db.as<{ id: string }>(editor, `insert into public.chapters (story_id, position, title, body_md ${extra ? ", " + extra.split("=")[0] : ""}) values ($1, $2, 'Fixture chapter', 'Fixture body' ${extra ? ", " + extra.split("=")[1] : ""}) returning id`, [story, position]);
  return c!.id;
}
const status = async (table: string, id: string) => (await db.admin<{ status: string }>(`select status from public.${table} where id = $1`, [id]))[0]!.status;
const version = async (table: string, id: string) => (await db.admin<{ version: number }>(`select version from public.${table} where id = $1`, [id]))[0]!.version;
const flags = (type: string, id: string) =>
  db.admin<{ reason: string; flagged_at: string }>("select reason, flagged_at from public.content_dependency_versions where dependant_type = $1 and dependant_id = $2 and stale and cleared_at is null", [type, id]);

/** A published chapter with one approved claim; returns ids. */
async function publishedChapter(): Promise<{ story: string; chapter: string; claim: string }> {
  const claim = await newClaim();
  await approveClaim(claim);
  const story = await newStory();
  const chapter = await newChapter(story);
  await db.as(editor, "insert into public.chapter_claims (chapter_id, claim_id) values ($1, $2)", [chapter, claim]);
  await review("chapter", chapter);
  await db.as(editor, "update public.chapters set status = 'published' where id = $1", [chapter]);
  await review("story", story);
  await db.as(editor, "update public.stories set status = 'published' where id = $1", [story]);
  return { story, chapter, claim };
}

beforeAll(async () => {
  db = await createDb({ supabaseDefaults: true });
  editor = await db.createUser("editor@test.local", ["editor"]);
  reviewer = await db.createUser("reviewer@test.local", ["scholarly_reviewer"]);
  both = await db.createUser("both@test.local", ["editor", "scholarly_reviewer"]);
  plain = await db.createUser("plain@test.local");
  admin = await db.createUser("admin@test.local", ["admin"]);
  [{ id: sourceId }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id")) as [{ id: string }];
  [{ id: versionId }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [sourceId],
  )) as [{ id: string }];
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (12, 'x', 'Fixture', 111, $1)", [versionId]);
  for (let a = 1; a <= 9; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (12, $1, $2, $3)", [a, FIXTURE, versionId]);
}, 240_000);

describe("chapters: anchors, depth modes, links", () => {
  test("an anchor defaults to the position, is unique per story, and must be a slug", async () => {
    const s = await newStory();
    const c = await newChapter(s, 4);
    expect((await db.admin<{ anchor: string }>("select anchor from public.chapters where id = $1", [c]))[0]!.anchor).toBe("4");
    await rejects(newChapter(s, 5, "anchor='4'"), /duplicate key/);
    await rejects(newChapter(s, 6, "anchor='Not A Slug'"), /check constraint/);
    await newChapter(s, 7, "anchor='the-flood'");
  });
  test("depth modes and the event link are columns of the chapter; modes may stay empty", async () => {
    const s = await newStory();
    const [ev] = await db.admin<{ id: string }>("select id from public.historical_events where slug = 'yunus'");
    const [c] = await db.as<{ id: string; summary_md: string | null; event_id: string }>(
      editor,
      "insert into public.chapters (story_id, position, title, summary_md, kids_md, event_id) values ($1, 1, 'Modes', 'One-minute fixture', 'Kids fixture', $2) returning id, summary_md, event_id",
      [s, ev!.id],
    );
    expect(c!.summary_md).toBe("One-minute fixture");
    expect(c!.event_id).toBe(ev!.id);
    const [row] = await db.admin<{ deep_md: string | null; lessons_md: string | null }>("select deep_md, lessons_md from public.chapters where id = $1", [c!.id]);
    expect(row).toEqual({ deep_md: null, lessons_md: null });
  });
  test("the verse references of a chapter come from its claims' Quran references", async () => {
    const claim = await newClaim();
    await approveClaim(claim, 2, 4);
    const s = await newStory();
    const c = await newChapter(s);
    await db.as(editor, "insert into public.chapter_claims (chapter_id, claim_id) values ($1, $2)", [c, claim]);
    expect(await db.as(editor, "select surah, ayah_from, ayah_to from public.chapter_verse_refs where chapter_id = $1", [c])).toEqual([{ surah: 12, ayah_from: 2, ayah_to: 4 }]);
    // A draft chapter is invisible to the public, and so are its references.
    expect(await db.as(null, "select * from public.chapter_verse_refs where chapter_id = $1", [c])).toHaveLength(0);
  });
});

describe("chapters: publish guards", () => {
  test("a chapter needs approved claims, a Quran or hadith reference, and a scholarly review of THIS version", async () => {
    const s = await newStory();
    const c = await newChapter(s);
    await rejects(db.as(editor, "update public.chapters set status = 'published' where id = $1", [c]), /no evidence, no publish/);
    // A claim that rests only on a scholar source carries no Quran or hadith reference.
    const [scholar] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ('Fixture scholar-only claim', 'scholar', $1) returning id", [editor]);
    await db.as(editor, "insert into public.claim_references (claim_id, kind, source_id, locator) values ($1, 'scholar', $2, 'p. 1')", [scholar!.id, sourceId]);
    await review("claim", scholar!.id);
    await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [scholar!.id]);
    await db.as(editor, "insert into public.chapter_claims (chapter_id, claim_id) values ($1, $2)", [c, scholar!.id]);
    await review("chapter", c);
    await rejects(db.as(editor, "update public.chapters set status = 'published' where id = $1", [c]), /Quran or authentic hadith reference/);
    const claim = await newClaim();
    await approveClaim(claim);
    await db.as(editor, "insert into public.chapter_claims (chapter_id, claim_id) values ($1, $2)", [c, claim]);
    // Adding the claim made a new version: the earlier approval no longer counts.
    await rejects(db.as(editor, "update public.chapters set status = 'published' where id = $1", [c]), /review of this version/);
    await review("chapter", c);
    await db.as(editor, "update public.chapters set status = 'published' where id = $1", [c]);
    expect(await status("chapters", c)).toBe("published");
  });

  test("editing a draft after its approval makes a new version, so the approval goes stale", async () => {
    const claim = await newClaim();
    await approveClaim(claim);
    const s = await newStory();
    const c = await newChapter(s);
    await db.as(editor, "insert into public.chapter_claims (chapter_id, claim_id) values ($1, $2)", [c, claim]);
    await review("chapter", c);
    const v = await version("chapters", c);
    await db.as(editor, "update public.chapters set body_md = 'Edited after the review' where id = $1", [c]);
    expect(await version("chapters", c)).toBe(v + 1);
    await rejects(db.as(editor, "update public.chapters set status = 'published' where id = $1", [c]), /review of this version/);
    // A later request for changes also withdraws an approval.
    await review("chapter", c);
    await review("chapter", c, "changes_requested");
    await rejects(db.as(editor, "update public.chapters set status = 'published' where id = $1", [c]), /no review, no publish/);
  });

  test("a published chapter is frozen, and so are its claims; correction reopens it as a new version", async () => {
    const { chapter, story } = await publishedChapter();
    await rejects(db.as(editor, "update public.chapters set body_md = 'Changed in place' where id = $1", [chapter]), /frozen/);
    await rejects(db.as(editor, "update public.chapters set kids_md = 'Changed in place' where id = $1", [chapter]), /frozen/);
    await rejects(db.as(editor, "update public.stories set summary = 'Changed in place' where id = $1", [story]), /frozen/);
    const other = await newClaim();
    await approveClaim(other);
    await rejects(db.as(editor, "insert into public.chapter_claims (chapter_id, claim_id) values ($1, $2)", [chapter, other]), /published chapter cannot change/);
    await rejects(db.as(editor, "delete from public.chapter_claims where chapter_id = $1", [chapter]), /published chapter cannot change/);
    const v = await version("chapters", chapter);
    await db.as(editor, "update public.chapters set status = 'correction' where id = $1", [chapter]);
    await db.as(editor, "update public.chapters set body_md = 'Corrected text' where id = $1", [chapter]);
    expect(await version("chapters", chapter)).toBe(v + 1);
    await rejects(db.as(editor, "update public.chapters set status = 'published' where id = $1", [chapter]), /review of this version/);
    await review("chapter", chapter);
    await db.as(editor, "update public.chapters set status = 'published' where id = $1", [chapter]);
    // The change history snapshotted the published rows.
    expect((await db.admin<{ n: number }>("select count(*)::int n from public.content_versions where entity_id = $1", [chapter]))[0]!.n).toBeGreaterThan(1);
  });

  test("an author who is also a reviewer cannot approve their own chapter, and the author column is stamped", async () => {
    const s = await newStory();
    const [c] = await db.as<{ id: string; created_by: string }>(both, "insert into public.chapters (story_id, position, title, created_by) values ($1, 1, 'Own', $2) returning id, created_by", [s, editor]);
    expect(c!.created_by).toBe(both);
    await rejects(review2(both, "chapter", c!.id), /cannot review their own/);
    await review("chapter", c!.id);
  });
});
const review2 = (who: string, type: string, id: string) =>
  db.as(who, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ($1, $2, $3, 'approved')", [type, id, who]);

describe("source-change invalidation", () => {
  test("a claim whose text changes flags its chapter and story; the published snapshot stays as it was", async () => {
    const { chapter, story, claim } = await publishedChapter();
    const before = (await db.admin<{ body_md: string; status: string }>("select body_md, status from public.chapters where id = $1", [chapter]))[0]!;
    // Moving the claim to correction is a change to the source.
    await db.as(editor, "update public.evidence_claims set status = 'correction' where id = $1", [claim]);
    await db.as(editor, "update public.evidence_claims set statement = 'Fixture claim, reworded after review' where id = $1", [claim]);
    const f = await flags("chapter", chapter);
    expect(f).toHaveLength(1);
    expect(f[0]!.reason).toMatch(/no longer approved/);
    expect(f[0]!.flagged_at).toBeTruthy();
    expect(await flags("story", story)).toHaveLength(1);
    const after = (await db.admin<{ body_md: string; status: string }>("select body_md, status from public.chapters where id = $1", [chapter]))[0]!;
    expect(after).toEqual(before);
    expect(await status("chapters", chapter)).toBe("published");
    // The public still reads the frozen chapter.
    expect(await db.as(null, "select id from public.chapters where id = $1", [chapter])).toHaveLength(1);
  });

  test("a text change on a claim that stays approved is flagged too", async () => {
    const { chapter, claim } = await publishedChapter();
    await db.as(editor, "update public.evidence_claims set statement = 'Fixture claim with a changed statement' where id = $1", [claim]);
    expect((await flags("chapter", chapter))[0]!.reason).toMatch(/text or evidence class/);
  });

  test("adding, changing or removing a reference on an approved claim flags its dependants; a draft claim does not", async () => {
    const { chapter, claim } = await publishedChapter();
    const [ref] = await db.as<{ id: string }>(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 12, 6) returning id", [claim]);
    expect((await flags("chapter", chapter))[0]!.reason).toMatch(/Quran reference 12:6 .*added/);
    await db.admin("update public.content_dependency_versions set cleared_at = now() where dependant_id = $1", [chapter]);
    await db.as(editor, "update public.claim_references set quran_ayah_from = 7 where id = $1", [ref!.id]);
    expect((await flags("chapter", chapter))[0]!.reason).toMatch(/changed/);
    await db.admin("update public.content_dependency_versions set cleared_at = now() where dependant_id = $1", [chapter]);
    await db.as(editor, "delete from public.claim_references where id = $1", [ref!.id]);
    expect((await flags("chapter", chapter))[0]!.reason).toMatch(/removed/);
    // Drafts are not flagged: they have not been reviewed.
    const draftClaim = await newClaim();
    const s = await newStory();
    const c = await newChapter(s);
    await db.as(editor, "insert into public.chapter_claims (chapter_id, claim_id) values ($1, $2)", [c, draftClaim]);
    await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 12, 2)", [draftClaim]);
    expect(await flags("chapter", c)).toHaveLength(0);
  });

  test("a hadith grading recorded, changed or removed flags the claims that cite the narration", async () => {
    const [h] = await db.admin<{ id: string }>(
      "insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic, status) values ('tirmidhi', 'fixture-inv', '9001', $1, $2, 'published') returning id",
      [versionId, FIXTURE],
    );
    const [g] = await db.admin<{ id: string }>(
      "insert into public.hadith_gradings (hadith_id, grader, grade, grade_label, source_id, citation) values ($1, 'Grader S', 'sahih', 'Sahih', $2, 'fixture') returning id",
      [h!.id, sourceId],
    );
    const claim = await newClaim();
    await db.as(editor, "insert into public.claim_references (claim_id, kind, hadith_id, hadith_grading_id) values ($1, 'hadith', $2, $3)", [claim, h!.id, g!.id]);
    await review("claim", claim);
    await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [claim]);
    const s = await newStory();
    const c = await newChapter(s);
    await db.as(editor, "insert into public.chapter_claims (chapter_id, claim_id) values ($1, $2)", [c, claim]);
    await review("chapter", c);
    await db.as(editor, "update public.chapters set status = 'published' where id = $1", [c]);
    // An agreeing grading is not a change of substance.
    await db.admin("insert into public.hadith_gradings (hadith_id, grader, grade, grade_label, source_id, citation) values ($1, 'Grader T', 'hasan', 'Hasan', $2, 'fixture')", [h!.id, sourceId]);
    expect(await flags("chapter", c)).toHaveLength(0);
    // A dissenting grading is shown with the rest, so the chapter is looked at again.
    await db.admin("insert into public.hadith_gradings (hadith_id, grader, grade, grade_label, source_id, citation) values ($1, 'Grader D', 'daif', 'Daif', $2, 'fixture')", [h!.id, sourceId]);
    expect((await flags("chapter", c))[0]!.reason).toMatch(/daif grading by Grader D/);
    await db.admin("update public.content_dependency_versions set cleared_at = now() where dependant_id = $1", [c]);
    await db.admin("update public.hadith_gradings set grade = 'daif', grade_label = 'Daif' where id = $1", [g!.id]);
    expect((await flags("chapter", c))[0]!.reason).toMatch(/Grader S/);
  });

  test("a verse reference of the chapter's event flags the chapters and sections of that event", async () => {
    const [ev] = await db.admin<{ id: string }>("select id from public.historical_events where slug = 'hud'");
    const claim = await newClaim();
    await approveClaim(claim);
    const s = await newStory();
    const [c] = await db.as<{ id: string }>(editor, "insert into public.chapters (story_id, position, title, event_id) values ($1, 1, 'Event chapter', $2) returning id", [s, ev!.id]);
    await db.as(editor, "insert into public.chapter_claims (chapter_id, claim_id) values ($1, $2)", [c!.id, claim]);
    await review("chapter", c!.id);
    await db.as(editor, "update public.chapters set status = 'published' where id = $1", [c!.id]);
    await db.as(editor, "insert into public.event_verse_refs (event_id, surah, ayah_from, ayah_to) values ($1, 12, 8, 9)", [ev!.id]);
    expect((await flags("chapter", c!.id))[0]!.reason).toMatch(/verse reference of the event/);
  });

  test("sections, scripts, their translations and audio are flagged through the claim", async () => {
    const claim = await newClaim();
    await approveClaim(claim);
    const [p] = await db.as<{ id: string }>(editor, "insert into public.people (slug, name_en, name_ar, kind) values ('inv-fixture', 'Fixture', 'x', 'prophet') returning id");
    const [sec] = await db.as<{ id: string }>(editor, "insert into public.story_sections (person_id, section, body_md, claim_id, status) values ($1, 'calling', 'Fixture', $2, 'in_review') returning id", [p!.id, claim]);
    const [script] = await db.admin<{ id: string }>("insert into public.story_scripts (person_id, title, origin, created_by, status) values ($1, 'Fixture script', 'human', $2, 'in_review') returning id", [p!.id, editor]);
    const [scene] = await db.admin<{ id: string }>("insert into public.story_scenes (script_id, position, scene_kind, title, narration_text) values ($1, 1, 'world', 'Scene', 'Fixture narration') returning id", [script!.id]);
    await db.as(editor, "insert into public.scene_claim_references (scene_id, claim_id) values ($1, $2)", [scene!.id, claim]);
    const [voice] = await db.admin<{ id: string }>("insert into public.narration_voices (provider, provider_voice_id, language, label, active, licence_source_id) values ('fx', 'v1', 'en', 'Fixture voice', true, $1) returning id", [sourceId]);
    const [audio] = await db.admin<{ id: string }>(
      "insert into public.narration_audio (scene_id, scene_version, voice_id, text_sha256, storage_path, duration_ms, bytes, mime_type, status, pronunciation_ok, approved_by) values ($1, 1, $2, repeat('b', 64), 'fx/inv.mp3', 1000, 1000, 'audio/mpeg', 'approved', true, $3) returning id",
      [scene!.id, voice!.id, admin],
    );
    const [tr] = await db.admin<{ id: string }>(
      "insert into public.story_scripts (person_id, title, origin, language, translated_from, translated_from_version, status, created_by) values ($1, 'Translation', 'human', 'ar', $2, 1, 'in_review', $3) returning id",
      [p!.id, script!.id, editor],
    );
    await db.as(editor, "update public.evidence_claims set statement = 'Fixture claim changed after the section was sent for review' where id = $1", [claim]);
    expect(await flags("story_section", sec!.id)).toHaveLength(1);
    expect(await flags("story_script", script!.id)).toHaveLength(1);
    expect(await flags("story_script", tr!.id)).toHaveLength(1);
    expect(await flags("narration_audio", audio!.id)).toHaveLength(1);
    // Audio is flagged, not switched off.
    expect((await db.admin<{ status: string }>("select status from public.narration_audio where id = $1", [audio!.id]))[0]!.status).toBe("approved");
  });

  test("a flagged chapter cannot be republished until a scholar approves it again after the flag", async () => {
    const { chapter, claim } = await publishedChapter();
    await db.as(editor, "update public.evidence_claims set statement = 'Fixture claim changed again after publication' where id = $1", [claim]);
    expect(await flags("chapter", chapter)).toHaveLength(1);
    await db.as(editor, "update public.chapters set status = 'correction' where id = $1", [chapter]);
    await db.as(editor, "update public.chapters set body_md = 'Corrected to match the claim' where id = $1", [chapter]);
    await rejects(db.as(editor, "update public.chapters set status = 'published' where id = $1", [chapter]), /review of this version/);
    await review("chapter", chapter);
    // The fresh review cleared the flag, so the chapter can go back.
    expect(await flags("chapter", chapter)).toHaveLength(0);
    await db.as(editor, "update public.chapters set status = 'published' where id = $1", [chapter]);
  });

  test("a review does not clear the flag while a claim is still not approved", async () => {
    const { chapter, claim } = await publishedChapter();
    await db.as(editor, "update public.evidence_claims set status = 'correction' where id = $1", [claim]);
    await review("chapter", chapter);
    expect(await flags("chapter", chapter)).toHaveLength(1);
    // And a non-approval never clears.
    await review("chapter", chapter, "changes_requested");
    expect(await flags("chapter", chapter)).toHaveLength(1);
  });

  test("the queue is staff only and lists reasons", async () => {
    const { chapter, claim } = await publishedChapter();
    await db.as(editor, "update public.evidence_claims set statement = 'Fixture claim for the queue test' where id = $1", [claim]);
    const rows = await db.as<{ dependant_id: string; reasons: string[]; title: string }>(editor, "select dependant_id, reasons, title from public.story_needs_rereview()");
    const mine = rows.find((r) => r.dependant_id === chapter);
    expect(mine?.title).toBe("Fixture chapter");
    expect(mine?.reasons[0]).toMatch(/claim it rests on/);
    expect(await db.as(plain, "select * from public.story_needs_rereview()")).toHaveLength(0);
    await rejects(db.as(null, "select * from public.story_needs_rereview()"), /permission denied/);
    // The dependency rows themselves are staff-readable only.
    expect(await db.as(plain, "select * from public.content_dependency_versions")).toHaveLength(0);
  });
});

describe("story coverage: derived, staff only", () => {
  test("anonymous callers cannot call the coverage functions; a signed-in non-staff user gets nothing", async () => {
    for (const fn of ["story_coverage_by_subject()", "story_coverage_refs()", "story_check_inputs()", "story_coverage_counts()"])
      await rejects(db.as(null, `select * from public.${fn}`), /permission denied/);
    expect(await db.as(plain, "select * from public.story_coverage_by_subject()")).toHaveLength(0);
    expect((await db.as<{ c: unknown }>(plain, "select public.story_coverage_counts() as c"))[0]!.c).toBeNull();
    expect((await db.as<{ c: unknown }>(plain, "select public.story_check_inputs() as c"))[0]!.c).toBeNull();
  });

  test("anonymous callers see published counts only, never a title", async () => {
    const rows = await db.as<Record<string, number>>(null, "select * from public.story_coverage_public");
    expect(Object.keys(rows[0]!).sort()).toEqual(["chapters_published", "sections_published", "stories_published"]);
    const before = rows[0]!.chapters_published!;
    const s = await newStory();
    await newChapter(s, 1); // a draft
    expect((await db.as<Record<string, number>>(null, "select * from public.story_coverage_public"))[0]!.chapters_published).toBe(before);
  });

  test("figures are derived from the records: discovered, researched, reviewed and published are separate counts", async () => {
    const rows = await db.as<{ slug: string; track: string; chapters: number; chapters_reviewed: number; chapters_published: number; researched: boolean; reviewed: boolean; published: boolean; claims: number; verse_refs: number }>(
      editor,
      "select * from public.story_coverage_by_subject()",
    );
    expect(rows.filter((r) => r.track === "prophets")).toHaveLength(25);
    expect(rows.length).toBe(159);
    // Every item exists (discovered) and none has been researched, reviewed or published by a title alone.
    const nuh = rows.find((r) => r.slug === "nuh")!;
    expect(nuh.verse_refs).toBeGreaterThan(0);
    expect({ chapters: nuh.chapters, reviewed: nuh.reviewed, published: nuh.published, researched: nuh.researched }).toEqual({ chapters: 0, reviewed: false, published: false, researched: false });

    // A chapter linked to the event: drafted, then reviewed, then published, each counted on its own.
    const [ev] = await db.admin<{ id: string }>("select id from public.historical_events where slug = 'nuh'");
    const claim = await newClaim();
    await approveClaim(claim, 1, 2);
    const s = await newStory();
    const [c] = await db.as<{ id: string }>(editor, "insert into public.chapters (story_id, position, title, body_md, event_id) values ($1, 1, 'Nuh chapter', 'Fixture text', $2) returning id", [s, ev!.id]);
    await db.as(editor, "insert into public.chapter_claims (chapter_id, claim_id) values ($1, $2)", [c!.id, claim]);
    const get = async () => (await db.as<(typeof rows)[number]>(editor, "select * from public.story_coverage_by_subject() where slug = 'nuh'"))[0]!;
    let r = await get();
    expect([r.chapters, r.chapters_reviewed, r.chapters_published, r.claims, r.researched]).toEqual([1, 0, 0, 1, true]);
    await review("chapter", c!.id);
    r = await get();
    expect([r.chapters_reviewed, r.chapters_published, r.reviewed, r.published]).toEqual([1, 0, true, false]);
    await db.as(editor, "update public.chapters set status = 'published' where id = $1", [c!.id]);
    r = await get();
    expect([r.chapters_published, r.published]).toEqual([1, false]); // the item itself is not published yet
    // Editing the draft after the review makes the approval stale again.
    await db.as(editor, "update public.chapters set status = 'correction' where id = $1", [c!.id]);
    await db.as(editor, "update public.chapters set body_md = 'Edited' where id = $1", [c!.id]);
    r = await get();
    expect([r.chapters_reviewed, r.chapters_published]).toEqual([0, 0]);
  });

  test("counts are the sum of the rows and carry no titles", async () => {
    const [{ c }] = await db.as<{ c: Record<string, number> }>(editor, "select public.story_coverage_counts() as c") as [{ c: Record<string, number> }];
    expect(c.discovered).toBe(159);
    expect(Object.values(c).every((v) => typeof v === "number")).toBe(true);
    expect(c.published).toBe(0);
  });

  test("indexed Quran passages come from event references and chapters, with their verification state", async () => {
    const rows = await db.as<{ source: string; surah: number; verified: boolean }>(editor, "select source, surah, verified from public.story_coverage_refs()");
    expect(rows.some((r) => r.source === "event")).toBe(true);
    expect(rows.some((r) => r.source === "chapter" && r.surah === 12 && r.verified)).toBe(true);
    expect(rows.filter((r) => r.source === "event").every((r) => r.verified === false)).toBe(true); // the seeded inventory has no approved claims
  });
});

describe("automated checks over real rows", () => {
  test("the checks run over the database inputs and name what is wrong", async () => {
    // A chapter with no claims, a person labelled a prophet who is not one, a contradictory family pair.
    const s = await newStory();
    await newChapter(s, 1);
    await db.as(editor, "insert into public.people (slug, name_en, name_ar, kind) values ('not-a-prophet', 'Fixture', 'x', 'prophet'), ('fx-parent', 'P', 'x', 'other'), ('fx-child', 'C', 'x', 'other')");
    const claim = await newClaim();
    await approveClaim(claim);
    const [pp] = await db.admin<{ id: string }>("select id from public.people where slug = 'fx-parent'");
    const [cc] = await db.admin<{ id: string }>("select id from public.people where slug = 'fx-child'");
    for (const kind of ["parent_of", "sibling_of"])
      await db.as(editor, "insert into public.relationships (person_from, person_to, kind, claim_id, confidence) values ($1, $2, $3, $4, 'scholar')", [pp!.id, cc!.id, kind, claim]);
    const inputs = (await db.as<{ i: DbInputs }>(editor, "select public.story_check_inputs() as i"))[0]!.i;
    expect(inputs.chapters.length).toBeGreaterThan(3);
    const content = {
      ayahCounts: [0, ...new Array(11).fill(7), 9],
      inventory: [{ slug: "nuh", title: "Nuh", track: "prophets", refs: ["7:59-64"] }],
      journey: [],
      routes: { topLevel: ["quran", "prophets", "events", "stories"], prophetIds: ["nuh"], eventSlugs: [], storySlugs: inputs.stories.map((x) => x.slug) },
    };
    const findings = runChecks({ content, db: inputs });
    const has = (check: string, re: RegExp) => findings.some((f) => f.check === check && re.test(`${f.subject} ${f.message}`));
    expect(has("missing_quran_reference", /has no claims at all/)).toBe(true);
    expect(has("non_prophet_labelled_prophet", /not-a-prophet/)).toBe(true);
    expect(has("contradictory_genealogy", /parent and child and also as siblings/)).toBe(true);
  });
});
