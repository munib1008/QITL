// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/** Life Guidance: three separate layers, publish guards ("no evidence, no review, no publish"), safety notes and RLS. */
const FIXTURE = "[TEST FIXTURE — placeholder, not Quran or hadith text]";

let db: Db;
let editor: string, reviewer: string, alice: string, admin: string;
let versionId: string, tafsirSource: string, gradeSource: string;
let quranClaim: string, scholarClaim: string, mixedClaim: string, sahihHadithClaim: string, draftClaim: string;
let topic: string, distressTopic: string;

async function newClaim(statement: string, evidence: string): Promise<string> {
  const [r] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ($1, $2, $3) returning id", [statement, evidence, editor]);
  return r!.id;
}
const review = (type: string, id: string, decision = "approved") =>
  db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ($1, $2, $3, $4)", [type, id, reviewer, decision]);
async function approve(id: string) {
  await review("claim", id);
  await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [id]);
}
async function hadith(no: string, grade: string): Promise<{ id: string; grading: string }> {
  const [h] = await db.admin<{ id: string }>(
    "insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic, status) values ('tirmidhi', 'fixture-guidance', $1, $2, $3, 'published') returning id",
    [no, versionId, FIXTURE],
  );
  const [g] = await db.admin<{ id: string }>(
    "insert into public.hadith_gradings (hadith_id, grader, grade, grade_label, source_id, citation) values ($1, 'Fixture grader', $2, $2, $3, 'fixture') returning id",
    [h!.id, grade, gradeSource],
  );
  return { id: h!.id, grading: g!.id };
}
async function newTopic(slug: string, distress = false): Promise<string> {
  const [t] = await db.as<{ id: string }>(editor, "insert into public.guidance_topics (slug, title_en, title_ar, distress) values ($1, 'Fixture topic', 'x x', $2) returning id", [slug, distress]);
  return t!.id;
}
async function newLesson(topicId: string, application = "An educational suggestion for everyday life."): Promise<string> {
  const [l] = await db.as<{ id: string }>(editor, "insert into public.guidance_lessons (topic_id, title_en, application_en) values ($1, 'Fixture lesson', $2) returning id", [topicId, application]);
  return l!.id;
}
const link = (lesson: string, claim: string, layer: string, scholar: string | null = null, work: string | null = null) =>
  db.as(editor, "insert into public.guidance_lesson_claims (lesson_id, claim_id, layer, scholar_name, work_title) values ($1, $2, $3, $4, $5)", [lesson, claim, layer, scholar, work]);
const publish = (table: string, id: string) => db.as(editor, `update public.${table} set status = 'published' where id = $1`, [id]);

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("editor@test.local", ["editor"]);
  reviewer = await db.createUser("reviewer@test.local", ["scholarly_reviewer"]);
  alice = await db.createUser("alice@test.local");
  admin = await db.createUser("admin@test.local", ["admin"]);
  const [src] = await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id");
  [{ id: versionId }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [src!.id],
  )) as [{ id: string }];
  [{ id: tafsirSource }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('tafsir', 'Fixture tafsir', 'cleared') returning id")) as [{ id: string }];
  [{ id: gradeSource }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('hadith_grading', 'Fixture gradings', 'cleared') returning id")) as [{ id: string }];
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (3, 'x', 'Fixture', 200, $1)", [versionId]);
  for (const a of [134, 159]) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (3, $1, $2, $3)", [a, FIXTURE, versionId]);

  quranClaim = await newClaim("Fixture: a verse-based statement", "quran");
  await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 3, 134)", [quranClaim]);
  await approve(quranClaim);

  scholarClaim = await newClaim("Fixture: a scholar's explanation", "scholar");
  await db.as(editor, "insert into public.claim_references (claim_id, kind, source_id, locator) values ($1, 'tafsir', $2, 'vol. 1, p. 1')", [scholarClaim, tafsirSource]);
  await approve(scholarClaim);

  // A Quran claim that also leans on a commentary reference does not belong in the revelation layer.
  mixedClaim = await newClaim("Fixture: a verse plus a commentary", "quran");
  await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 3, 159)", [mixedClaim]);
  await db.as(editor, "insert into public.claim_references (claim_id, kind, source_id, locator) values ($1, 'tafsir', $2, 'p. 2')", [mixedClaim, tafsirSource]);
  await approve(mixedClaim);

  const sahih = await hadith("902", "sahih");
  sahihHadithClaim = await newClaim("Fixture: a statement from an authentic narration", "hadith");
  await db.as(editor, "insert into public.claim_references (claim_id, kind, hadith_id, hadith_grading_id) values ($1, 'hadith', $2, $3)", [sahihHadithClaim, sahih.id, sahih.grading]);
  await approve(sahihHadithClaim);

  draftClaim = await newClaim("Fixture: a claim nobody approved yet", "quran");
  topic = await newTopic("fixture-topic");
  distressTopic = await newTopic("fixture-distress", true);
}, 180_000);

describe("life guidance schema", () => {
  test("the starting topics are seeded as drafts without lessons, hidden from readers", async () => {
    const seeded = await db.admin<{ slug: string; status: string }>("select slug, status from public.guidance_topics where slug = 'feeling-overwhelmed'");
    expect(seeded).toEqual([{ slug: "feeling-overwhelmed", status: "draft" }]);
    expect(await db.admin("select 1 from public.guidance_lessons l join public.guidance_topics t on t.id = l.topic_id where t.slug = 'feeling-overwhelmed'")).toHaveLength(0);
    expect(await db.as(null, "select id from public.guidance_topics")).toHaveLength(0);
    expect(await db.as(alice, "select id from public.guidance_topics")).toHaveLength(0);
  });

  test("the review entity types are registered by insert", async () => {
    const rows = await db.admin<{ type: string }>("select type from public.review_entity_types where module = 'life_guidance' order by type");
    expect(rows.map((r) => r.type)).toEqual(["guidance_lesson", "guidance_link", "guidance_safety_note", "guidance_topic"]);
  });

  test("ordinary users and anonymous visitors cannot write guidance", async () => {
    await rejects(db.as(alice, "insert into public.guidance_topics (slug, title_en, title_ar) values ('alice-topic', 'Alice', 'x x')"), /row-level security|permission denied/);
    await rejects(db.as(null, "insert into public.guidance_topics (slug, title_en, title_ar) values ('anon-topic', 'Anon', 'x x')"), /row-level security|permission denied/);
    await rejects(db.as(alice, "insert into public.guidance_lessons (topic_id, title_en) values ($1, 'x x')", [topic]), /row-level security|permission denied/);
  });

  test("editors cannot insert straight into published", async () => {
    await rejects(db.as(editor, "insert into public.guidance_topics (slug, title_en, title_ar, status) values ('pub-topic', 'Pub', 'x x', 'published')"), /row-level security|at least one published lesson/);
  });

  test("a scholarly explanation must name its scholar and work; revelation carries none", async () => {
    const lesson = await newLesson(topic);
    await rejects(link(lesson, scholarClaim, "scholarly_interpretation"), /check constraint/);
    await rejects(link(lesson, quranClaim, "revelation", "Someone", "Some work"), /check constraint/);
  });

  test("a lesson publishes only with approved revelation + scholarly claims, an application and a scholarly approval", async () => {
    const lesson = await newLesson(topic, "");
    await review("guidance_lesson", lesson);
    await rejects(publish("guidance_lessons", lesson), /everyday application/);
    await db.as(editor, "update public.guidance_lessons set application_en = 'An educational suggestion, labelled as such.' where id = $1", [lesson]);
    await rejects(publish("guidance_lessons", lesson), /at least one revelation claim/);
    await link(lesson, draftClaim, "revelation");
    await rejects(publish("guidance_lessons", lesson), /scholarly explanation/);
    await link(lesson, scholarClaim, "scholarly_interpretation", "Fixture scholar", "Fixture tafsir");
    await rejects(publish("guidance_lessons", lesson), /is not approved/);
    await db.as(editor, "delete from public.guidance_lesson_claims where lesson_id = $1 and claim_id = $2", [lesson, draftClaim]);
    await link(lesson, quranClaim, "revelation");
    // The edits after the approval bumped the version; the approval still stands as the latest review.
    await publish("guidance_lessons", lesson);
    const [row] = await db.admin<{ status: string; version: number }>("select status, version from public.guidance_lessons where id = $1", [lesson]);
    expect(row!.status).toBe("published");
    expect(row!.version).toBeGreaterThan(1);
  });

  test("no review, no publish: a changes-requested lesson stays unpublished", async () => {
    const lesson = await newLesson(topic);
    await link(lesson, quranClaim, "revelation");
    await link(lesson, scholarClaim, "scholarly_interpretation", "Fixture scholar", "Fixture tafsir");
    await rejects(publish("guidance_lessons", lesson), /no review, no publish/);
    await review("guidance_lesson", lesson);
    await review("guidance_lesson", lesson, "changes_requested");
    await rejects(publish("guidance_lessons", lesson), /no review, no publish/);
  });

  test("revelation rests only on Quran or hadith with an authentic grading; scholarly claims must be scholarly_interpretation", async () => {
    // A weak narration cannot even be cited as evidence (the storytelling hadith rule applies to every claim).
    const weak = await hadith("901", "daif");
    const weakClaim = await newClaim("Fixture: a statement from a weak narration", "hadith");
    await rejects(
      db.as(editor, "insert into public.claim_references (claim_id, kind, hadith_id, hadith_grading_id) values ($1, 'hadith', $2, $3)", [weakClaim, weak.id, weak.grading]),
      /graded sahih or hasan/,
    );

    const mixed = await newLesson(topic);
    await link(mixed, mixedClaim, "revelation");
    await link(mixed, scholarClaim, "scholarly_interpretation", "Fixture scholar", "Fixture tafsir");
    await review("guidance_lesson", mixed);
    await rejects(publish("guidance_lessons", mixed), /only Quran verses or hadith/);

    const scholarAsRevelation = await newLesson(topic);
    await link(scholarAsRevelation, scholarClaim, "revelation");
    await link(scholarAsRevelation, quranClaim, "scholarly_interpretation", "Fixture scholar", "Fixture tafsir");
    await review("guidance_lesson", scholarAsRevelation);
    await rejects(publish("guidance_lessons", scholarAsRevelation), /revelation layer|scholarly layer/);

    const ok = await newLesson(topic);
    await link(ok, sahihHadithClaim, "revelation");
    await link(ok, scholarClaim, "scholarly_interpretation", "Fixture scholar", "Fixture tafsir");
    await review("guidance_lesson", ok);
    await publish("guidance_lessons", ok);
  });

  test("a published lesson is frozen: no in-place edits, no claim changes", async () => {
    const [lesson] = await db.admin<{ id: string }>("select id from public.guidance_lessons where topic_id = $1 and status = 'published' limit 1", [topic]);
    await rejects(db.as(editor, "update public.guidance_lessons set application_en = 'Changed after publishing' where id = $1", [lesson!.id]), /cannot be edited in place/);
    await rejects(link(lesson!.id, sahihHadithClaim, "revelation"), /cannot change/);
    await rejects(db.as(editor, "delete from public.guidance_lesson_claims where lesson_id = $1", [lesson!.id]), /cannot change/);
  });

  test("published lessons stay hidden until their topic is published, then readers see the layers", async () => {
    expect(await db.as(null, "select id from public.guidance_lessons where topic_id = $1", [topic])).toHaveLength(0);
    expect(await db.as(null, "select id from public.guidance_lesson_claims")).toHaveLength(0);
    await rejects(publish("guidance_topics", topic), /no review, no publish/);
    await review("guidance_topic", topic);
    await publish("guidance_topics", topic);
    expect((await db.as(null, "select id from public.guidance_lessons where topic_id = $1", [topic])).length).toBeGreaterThanOrEqual(2);
    const layers = await db.as<{ layer: string }>(alice, "select distinct layer from public.guidance_lesson_claims order by layer");
    expect(layers.map((l) => l.layer)).toEqual(["revelation", "scholarly_interpretation"]);
    // Draft lessons of a published topic stay hidden.
    expect(await db.as(null, "select id from public.guidance_lessons where topic_id = $1 and status <> 'published'", [topic])).toHaveLength(0);
  });

  test("a topic needs a published lesson first", async () => {
    const empty = await newTopic("fixture-empty");
    await review("guidance_topic", empty);
    await rejects(publish("guidance_topics", empty), /at least one published lesson/);
  });

  test("a distress topic needs a reviewed medical / mental-health safety note before it is published", async () => {
    const lesson = await newLesson(distressTopic);
    await link(lesson, quranClaim, "revelation");
    await link(lesson, scholarClaim, "scholarly_interpretation", "Fixture scholar", "Fixture tafsir");
    await review("guidance_lesson", lesson);
    await publish("guidance_lessons", lesson);
    await review("guidance_topic", distressTopic);
    await rejects(publish("guidance_topics", distressTopic), /safety note/);
    const [ref] = await db.as<{ id: string }>(
      editor,
      "insert into public.guidance_safety_notes (topic_id, kind, body_en) values ($1, 'ruling_referral', 'Ask a qualified mufti for a personal ruling.') returning id",
      [distressTopic],
    );
    await review("guidance_safety_note", ref!.id);
    await publish("guidance_safety_notes", ref!.id);
    await rejects(publish("guidance_topics", distressTopic), /safety note/);
    const [note] = await db.as<{ id: string }>(
      editor,
      "insert into public.guidance_safety_notes (topic_id, kind, body_en) values ($1, 'mental_health', 'Please speak to a doctor or a mental-health professional.') returning id",
      [distressTopic],
    );
    await rejects(publish("guidance_safety_notes", note!.id), /no review, no publish/);
    await review("guidance_safety_note", note!.id);
    await publish("guidance_safety_notes", note!.id);
    await publish("guidance_topics", distressTopic);
    expect(await db.as(null, "select kind from public.guidance_safety_notes where topic_id = $1 order by kind", [distressTopic])).toEqual([{ kind: "mental_health" }, { kind: "ruling_referral" }]);
  });

  test("links point at exactly one target of their kind and publish only after review", async () => {
    const [person] = await db.as<{ id: string }>(editor, "insert into public.people (slug, name_en, name_ar, kind) values ('guidance-fixture', 'Fixture', 'x', 'prophet') returning id");
    await rejects(db.as(editor, "insert into public.guidance_links (topic_id, target_kind) values ($1, 'person')", [topic]), /check constraint/);
    await rejects(db.as(editor, "insert into public.guidance_links (topic_id, target_kind, person_id) values ($1, 'story', $2)", [topic, person!.id]), /check constraint/);
    const [l] = await db.as<{ id: string }>(editor, "insert into public.guidance_links (topic_id, target_kind, person_id) values ($1, 'person', $2) returning id", [topic, person!.id]);
    await rejects(publish("guidance_links", l!.id), /no review, no publish/);
    await review("guidance_link", l!.id);
    await publish("guidance_links", l!.id);
    expect(await db.as(null, "select id from public.guidance_links where id = $1", [l!.id])).toHaveLength(1);
  });

  test("admins cannot delete published guidance; drafts can be removed", async () => {
    await db.as(admin, "delete from public.guidance_topics where id = $1", [topic]);
    expect(await db.admin("select id from public.guidance_topics where id = $1", [topic])).toHaveLength(1);
    const draft = await newTopic("fixture-to-delete");
    await db.as(admin, "delete from public.guidance_topics where id = $1", [draft]);
    expect(await db.admin("select id from public.guidance_topics where id = $1", [draft])).toHaveLength(0);
  });
});
