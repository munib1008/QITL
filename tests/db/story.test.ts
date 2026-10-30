// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/** The storytelling model: sections A–G, reading levels on shared claims, quizzes, media and the hadith rule. */
const FIXTURE = "[TEST FIXTURE — placeholder, not Quran or hadith text]";

let db: Db;
let editor: string, reviewer: string, alice: string, admin: string;
let sourceId: string, versionId: string, person: string, claim: string;

async function newClaim(statement: string): Promise<string> {
  const [r] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ($1, 'quran', $2) returning id", [statement, editor]);
  return r!.id;
}
async function approveClaim(id: string) {
  await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 12, 3)", [id]);
  await db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [id, reviewer]);
  await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [id]);
}
const review = (type: string, id: string) =>
  db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ($1, $2, $3, 'approved')", [type, id, reviewer]);

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("editor@test.local", ["editor"]);
  reviewer = await db.createUser("reviewer@test.local", ["scholarly_reviewer"]);
  alice = await db.createUser("alice@test.local");
  admin = await db.createUser("admin@test.local", ["admin"]);
  [{ id: sourceId }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id")) as [{ id: string }];
  [{ id: versionId }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [sourceId],
  )) as [{ id: string }];
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (12, 'x', 'Fixture', 111, $1)", [versionId]);
  for (let a = 1; a <= 5; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (12, $1, $2, $3)", [a, FIXTURE, versionId]);
  [{ id: person }] = (await db.as<{ id: string }>(editor, "insert into public.people (slug, name_en, name_ar, kind) values ('story-fixture', 'Fixture', 'x', 'prophet') returning id")) as [{ id: string }];
  claim = await newClaim("Fixture claim behind a story section");
  await approveClaim(claim);
}, 180_000);

describe("story sections", () => {
  test("a person cannot be published without a scholarly approval", async () => {
    await rejects(db.as(editor, "update public.people set status = 'published' where id = $1", [person]), /no review, no publish/);
  });
  test("facts: unknown facts carry no value, established facts need one", async () => {
    await rejects(
      db.as(editor, "insert into public.story_sections (person_id, section, fact_key, known, value_text, claim_id) values ($1, 'fact', 'lifespan', false, '900 years', $2)", [person, claim]),
      /check constraint/,
    );
    await rejects(db.as(editor, "insert into public.story_sections (person_id, section, fact_key, claim_id) values ($1, 'fact', 'people_addressed', $2)", [person, claim]), /check constraint/);
    await db.as(editor, "insert into public.story_sections (person_id, section, fact_key, known, claim_id) values ($1, 'fact', 'lifespan', false, $2)", [person, claim]);
  });
  test("challenge steps need their place in the chain; takeaways need a lesson and an everyday example", async () => {
    await rejects(db.as(editor, "insert into public.story_sections (person_id, section, body_md, claim_id) values ($1, 'step', 'x', $2)", [person, claim]), /check constraint/);
    await db.as(editor, "insert into public.story_sections (person_id, section, step_group, step_role, body_md, claim_id) values ($1, 'step', 1, 'situation', 'Fixture step', $2)", [person, claim]);
    await rejects(
      db.as(editor, "insert into public.story_sections (person_id, section, title, body_md, claim_id) values ($1, 'takeaway', 'Patience', 'Meaning', $2)", [person, claim]),
      /check constraint/,
    );
    await db.as(editor, "insert into public.story_sections (person_id, section, title, body_md, everyday_example, claim_id) values ($1, 'takeaway', 'Patience', 'Meaning', 'An everyday example', $2)", [person, claim]);
  });
  test("ordinary users cannot write story content", async () => {
    await rejects(db.as(alice, "insert into public.story_sections (person_id, section, body_md, claim_id) values ($1, 'calling', 'x', $2)", [person, claim]), /row-level security|permission denied/);
  });
  test("kids and young versions adapt a full section on the same claim, publish after it, and show once the subject is published", async () => {
    const [full] = await db.as<{ id: string }>(editor, "insert into public.story_sections (person_id, section, body_md, claim_id) values ($1, 'calling', 'Full text', $2) returning id", [person, claim]);
    const other = await newClaim("A different fixture claim for the level test");
    await rejects(
      db.as(editor, "insert into public.story_sections (person_id, section, audience, base_section_id, body_md, claim_id) values ($1, 'calling', 'kids', $2, 'Kids text', $3)", [person, full!.id, other]),
      /same claim/,
    );
    await rejects(db.as(editor, "insert into public.story_sections (person_id, section, audience, body_md, claim_id) values ($1, 'calling', 'kids', 'Kids text', $2)", [person, claim]), /check constraint/);
    const [kids] = await db.as<{ id: string }>(
      editor,
      "insert into public.story_sections (person_id, section, audience, base_section_id, body_md, claim_id) values ($1, 'calling', 'kids', $2, 'Kids text', $3) returning id",
      [person, full!.id, claim],
    );
    await review("story_section", kids!.id);
    await rejects(db.as(editor, "update public.story_sections set status = 'published' where id = $1", [kids!.id]), /full section before/);
    await rejects(db.as(editor, "update public.story_sections set status = 'published' where id = $1", [full!.id]), /no review, no publish/);
    await review("story_section", full!.id);
    await db.as(editor, "update public.story_sections set status = 'published' where id = $1", [full!.id]);
    await db.as(editor, "update public.story_sections set status = 'published' where id = $1", [kids!.id]);
    expect(await db.as(null, "select id from public.story_sections where id = $1", [full!.id])).toHaveLength(0);
    await review("person", person);
    await db.as(editor, "update public.people set status = 'published' where id = $1", [person]);
    expect(await db.as(null, "select id from public.story_sections where status = 'published' and person_id = $1", [person])).toHaveLength(2);
  });
});

describe("quizzes", () => {
  test("answers in range, publish only with reviewed claims, questions locked once published", async () => {
    const [q] = await db.as<{ id: string }>(editor, "insert into public.story_quizzes (person_id, title) values ($1, 'Fixture quiz') returning id", [person]);
    await rejects(
      db.as(editor, "insert into public.quiz_questions (quiz_id, prompt, options, correct_index, claim_id) values ($1, 'Which option?', $2::jsonb, 2, $3)", [q!.id, JSON.stringify(["a", "b"]), claim]),
      /check constraint/,
    );
    await review("quiz", q!.id);
    await rejects(db.as(editor, "update public.story_quizzes set status = 'published' where id = $1", [q!.id]), /no evidence, no publish/);
    await db.as(editor, "insert into public.quiz_questions (quiz_id, prompt, options, correct_index, claim_id) values ($1, 'Which option?', $2::jsonb, 1, $3)", [q!.id, JSON.stringify(["a", "b"]), claim]);
    await db.as(editor, "update public.story_quizzes set status = 'published' where id = $1", [q!.id]);
    await rejects(db.as(editor, "update public.quiz_questions set correct_index = 0 where quiz_id = $1", [q!.id]), /is published/);
    expect(await db.as(null, "select id from public.quiz_questions where quiz_id = $1", [q!.id])).toHaveLength(1);
  });
});

describe("media", () => {
  test("animations are known symbolic components and need an approver and a review to publish", async () => {
    await rejects(
      db.as(editor, "insert into public.story_media (person_id, role, animation_key, caption, alt_text, claim_id) values ($1, 'animation', 'a-person-walking', 'x caption', 'x alt', $2)", [person, claim]),
      /check constraint/,
    );
    const [m] = await db.as<{ id: string }>(
      editor,
      "insert into public.story_media (person_id, role, animation_key, caption, alt_text, claim_id) values ($1, 'animation', 'rain-flood', 'Rain and rising water', 'Rain falls and water rises; no people are shown', $2) returning id",
      [person, claim],
    );
    await rejects(db.as(editor, "update public.story_media set status = 'published' where id = $1", [m!.id]), /check constraint|no review/);
    await rejects(db.as(editor, "update public.story_media set status = 'published', approved_by = $2 where id = $1", [m!.id, reviewer]), /no review, no publish/);
    await review("media", m!.id);
    await db.as(editor, "update public.story_media set status = 'published', approved_by = $2 where id = $1", [m!.id, reviewer]);
    expect(await db.as(null, "select id from public.story_media where id = $1", [m!.id])).toHaveLength(1);
  });
});

describe("hadith evidence", () => {
  test("only the four collections, and only with a named authentic grading", async () => {
    const mk = async (coll: string, n: string) =>
      (
        await db.admin<{ id: string }>(
          "insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic, status) values ($1, 'fixture-ev', $2, $3, $4, 'published') returning id",
          [coll, n, versionId, FIXTURE],
        )
      )[0]!.id;
    const nasai = await mk("nasai", "901");
    const tirmidhi = await mk("tirmidhi", "902");
    const c = await newClaim("Fixture claim citing a narration");
    await rejects(db.as(editor, "insert into public.claim_references (claim_id, kind, hadith_id) values ($1, 'hadith', $2)", [c, nasai]), /must come from/);
    await rejects(db.as(editor, "insert into public.claim_references (claim_id, kind, hadith_id) values ($1, 'hadith', $2)", [c, tirmidhi]), /must cite the authentic grading/);
    const [weak] = await db.admin<{ id: string }>(
      "insert into public.hadith_gradings (hadith_id, grader, grade, grade_label, source_id, citation) values ($1, 'Grader W', 'daif', 'Daif', $2, 'fixture') returning id",
      [tirmidhi, sourceId],
    );
    await rejects(db.as(editor, "insert into public.claim_references (claim_id, kind, hadith_id, hadith_grading_id) values ($1, 'hadith', $2, $3)", [c, tirmidhi, weak!.id]), /graded sahih or hasan/);
    const [ok] = await db.admin<{ id: string }>(
      "insert into public.hadith_gradings (hadith_id, grader, grade, grade_label, source_id, citation) values ($1, 'Grader S', 'sahih', 'Sahih', $2, 'fixture') returning id",
      [tirmidhi, sourceId],
    );
    await db.as(editor, "insert into public.claim_references (claim_id, kind, hadith_id, hadith_grading_id) values ($1, 'hadith', $2, $3)", [c, tirmidhi, ok!.id]);
    void admin;
  });
});
