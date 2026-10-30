// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Migrations 1150–1500: interpretation engine, story production and narration, the Creation Atlas and Mufti Q&A.
 * Every rule that keeps unreviewed or outdated religious content from the public is exercised here.
 */
const FIXTURE = "[TEST FIXTURE — placeholder, not Quran or hadith text]";

let db: Db;
let editor: string, reviewer: string, translator: string, audio: string, admin: string, mod: string, alice: string, bob: string, mufti: string, mufti2: string;
let sourceId: string, versionId: string, person: string, claim: string;

async function newClaim(statement: string, approve = true): Promise<string> {
  const [r] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ($1, 'quran', $2) returning id", [statement, editor]);
  if (approve) {
    await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 1, 2)", [r!.id]);
    await review("claim", r!.id);
    await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [r!.id]);
  }
  return r!.id;
}
const review = (type: string, id: string) =>
  db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ($1, $2, $3, 'approved')", [type, id, reviewer]);

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("editor@test.local", ["editor"]);
  reviewer = await db.createUser("reviewer@test.local", ["scholarly_reviewer"]);
  translator = await db.createUser("translator@test.local", ["translation_reviewer"]);
  audio = await db.createUser("audio@test.local", ["audio_producer"]);
  admin = await db.createUser("admin@test.local", ["admin"]);
  mod = await db.createUser("mod@test.local", ["moderator"]);
  alice = await db.createUser("alice@test.local");
  bob = await db.createUser("bob@test.local");
  mufti = await db.createUser("mufti@test.local", ["mufti"]);
  mufti2 = await db.createUser("mufti2@test.local", ["mufti"]);
  [{ id: sourceId }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id")) as [{ id: string }];
  [{ id: versionId }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [sourceId],
  )) as [{ id: string }];
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (1, 'x', 'Fixture', 7, $1)", [versionId]);
  for (let a = 1; a <= 7; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (1, $1, $2, $3)", [a, FIXTURE, versionId]);
  [{ id: person }] = (await db.as<{ id: string }>(editor, "insert into public.people (slug, name_en, name_ar, kind) values ('prod-fixture', 'Fixture', 'x', 'prophet') returning id")) as [{ id: string }];
  claim = await newClaim("Fixture claim");
}, 180_000);

describe("interpretation engine", () => {
  test("an edition is shown only when verified and its licence is cleared; early tafsir must state its reliability", async () => {
    await rejects(
      db.as(editor, "insert into public.translation_editions (kind, language, title, origin) values ('early_tafsir', 'ar', 'Fixture early tafsir', 'other')"),
      /check constraint/,
    );
    const [pending] = await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_translation', 'Pending translation', 'requested') returning id");
    const [e] = await db.as<{ id: string }>(
      editor,
      "insert into public.translation_editions (kind, language, title, origin, source_id, registry_status, verified_by, verified_at) values ('quran_translation', 'en', 'Fixture', 'other', $1, 'verified', $2, now()) returning id",
      [pending!.id, editor],
    );
    const [{ ok }] = (await db.as<{ ok: boolean }>(null, "select public.edition_displayable($1) as ok", [e!.id])) as [{ ok: boolean }];
    expect(ok).toBe(false);
  });

  test("an explanation publishes only after all eight checks pass on its current version and a scholar approves", async () => {
    const [x] = await db.as<{ id: string }>(
      editor,
      "insert into public.interpretation_explanations (surah_id, ayah_from, ayah_to, language, title, body_md, origin, model, prompt_version, created_by) values (1, 2, 2, 'en', 'Fixture', 'Draft', 'ai_assisted', 'claude-fixture', 'v1', $1) returning id",
      [editor],
    );
    const id = x!.id;
    await rejects(db.as(editor, "update public.interpretation_explanations set status = 'published' where id = $1", [id]), /no checks, no publish/);
    // A role may sign only its own checks.
    await rejects(
      db.as(editor, "insert into public.interpretation_reviews (explanation_id, explanation_version, check_key, passed, reviewer_id) values ($1, 1, 'sunni_scholarly', true, $2)", [id, editor]),
      /row-level security/,
    );
    const sign = (who: string, k: string, v = 1) =>
      db.as(who, "insert into public.interpretation_reviews (explanation_id, explanation_version, check_key, passed, reviewer_id) values ($1, $2, $3, true, $4)", [id, v, k, who]);
    for (const k of ["arabic_source", "references", "licensing", "attribution", "grammar"]) await sign(editor, k);
    for (const k of ["hadith_grading", "sunni_scholarly"]) await sign(reviewer, k);
    await sign(translator, "language_quality");
    await rejects(db.as(editor, "update public.interpretation_explanations set status = 'published' where id = $1", [id]), /no review, no publish/);
    // Editing the text makes version 2: the version-1 checks no longer count.
    await db.as(editor, "update public.interpretation_explanations set body_md = 'Revised' where id = $1", [id]);
    await review("interpretation", id);
    await rejects(db.as(editor, "update public.interpretation_explanations set status = 'published' where id = $1", [id]), /no checks, no publish/);
    for (const k of ["arabic_source", "references", "licensing", "attribution", "grammar"]) await sign(editor, k, 2);
    for (const k of ["hadith_grading", "sunni_scholarly"]) await sign(reviewer, k, 2);
    await sign(translator, "language_quality", 2);
    await db.as(editor, "update public.interpretation_explanations set status = 'published' where id = $1", [id]);
    const pub = await db.as(null, "select id from public.interpretation_explanations where id = $1", [id]);
    expect(pub).toHaveLength(1);
    await rejects(db.as(editor, "update public.interpretation_explanations set body_md = 'x' where id = $1", [id]), /cannot be edited in place/);
  });

  test("an AI-assisted draft must record its model and prompt version", async () => {
    await rejects(
      db.as(editor, "insert into public.interpretation_explanations (surah_id, ayah_from, ayah_to, language, title, body_md, origin, created_by) values (1, 2, 2, 'en', 'x', 'x', 'ai_assisted', $1)", [editor]),
      /check constraint/,
    );
  });

  test("word data from an uncleared source is hidden from the public", async () => {
    const [s] = await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('other', 'Corpus fixture', 'requested') returning id");
    const [v] = await db.admin<{ id: string }>(
      "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from) values ($1, 'c1', repeat('b', 64), now(), 'https://example.test') returning id",
      [s!.id],
    );
    await db.admin("insert into public.quran_word_morphology (surah_id, ayah_no, word_no, text_ar, pos, source_version_id) values (1, 2, 1, 'x', 'N', $1)", [v!.id]);
    expect(await db.as(null, "select * from public.quran_word_morphology")).toHaveLength(0);
    expect(await db.as(editor, "select * from public.quran_word_morphology")).toHaveLength(1);
  });
});

describe("story production and narration", () => {
  let script: string, scene: string, voice: string;
  test("a script cannot publish with a scene that has no claims, nor without a scholarly approval", async () => {
    const [s] = await db.as<{ id: string }>(editor, "insert into public.story_scripts (person_id, title, origin, created_by) values ($1, 'Fixture script', 'human', $2) returning id", [person, editor]);
    script = s!.id;
    const [sc] = await db.as<{ id: string }>(editor, "insert into public.story_scenes (script_id, position, scene_kind, title, narration_text) values ($1, 1, 'world', 'World', 'Fixture narration') returning id", [script]);
    scene = sc!.id;
    await rejects(db.as(editor, "update public.story_scripts set status = 'published' where id = $1", [script]), /scene\(s\) have no claims/);
    await db.as(editor, "insert into public.scene_claim_references (scene_id, claim_id) values ($1, $2)", [scene, claim]);
    await rejects(db.as(editor, "update public.story_scripts set status = 'published' where id = $1", [script]), /no review, no publish/);
  });

  test("audio needs a licensed voice and the current scene version; editing the scene makes its audio stale", async () => {
    await rejects(db.as(admin, "insert into public.narration_voices (provider, provider_voice_id, language, label, active) values ('fixture', 'v1', 'en', 'Fixture', true)"), /check constraint/);
    const [lic] = await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('other', 'TTS agreement fixture', 'cleared') returning id");
    const [v] = await db.as<{ id: string }>(admin, "insert into public.narration_voices (provider, provider_voice_id, language, label, licence_source_id, active) values ('fixture', 'v1', 'en', 'Fixture', $1, true) returning id", [lic!.id]);
    voice = v!.id;
    const [a] = await db.as<{ id: string }>(
      audio,
      "insert into public.narration_audio (scene_id, scene_version, voice_id, text_sha256, storage_path, duration_ms, bytes, mime_type) values ($1, 1, $2, repeat('c', 64), 'narration/fixture-1.mp3', 4000, 1000, 'audio/mpeg') returning id",
      [scene, voice],
    );
    await rejects(db.as(audio, "update public.narration_audio set status = 'approved', approved_by = $2 where id = $1", [a!.id, audio]), /check constraint/); // pronunciation not checked
    await db.as(audio, "update public.narration_audio set status = 'approved', approved_by = $2, pronunciation_ok = true where id = $1", [a!.id, audio]);
    await db.as(editor, "update public.story_scenes set narration_text = 'Fixture narration, revised' where id = $1", [scene]);
    const [row] = await db.admin<{ status: string }>("select status from public.narration_audio where id = $1", [a!.id]);
    expect(row!.status).toBe("stale");
    await rejects(
      db.as(audio, "insert into public.narration_audio (scene_id, scene_version, voice_id, text_sha256, storage_path, duration_ms, bytes, mime_type, status, approved_by, pronunciation_ok) values ($1, 1, $2, repeat('d', 64), 'narration/fixture-old.mp3', 4000, 1000, 'audio/mpeg', 'approved', $3, true)", [scene, voice, audio]),
      /outdated scene version/,
    );
  });

  test("publishing snapshots the version; unpublished scripts and their audio are hidden from the public", async () => {
    expect(await db.as(null, "select id from public.story_scenes where id = $1", [scene])).toHaveLength(0);
    await review("story_script", script);
    await db.as(editor, "update public.story_scripts set status = 'published' where id = $1", [script]);
    expect(await db.as(null, "select id from public.story_scenes where id = $1", [scene])).toHaveLength(1);
    const snaps = await db.as<{ version: number }>(null, "select version from public.story_publication_versions where script_id = $1", [script]);
    expect(snaps).toHaveLength(1);
    expect(await db.as(null, "select id from public.narration_audio where status <> 'approved'")).toHaveLength(0);
  });

  test("a translation publishes only from the current source version with linguistic and religious approval", async () => {
    const [{ version }] = (await db.admin<{ version: number }>("select version from public.story_scripts where id = $1", [script])) as [{ version: number }];
    const [t] = await db.as<{ id: string }>(
      translator,
      "insert into public.story_scripts (person_id, language, title, origin, model, prompt_version, translated_from, translated_from_version) values ($1, 'ar', 'Fixture AR', 'ai_assisted', 'lara', 'v1', $2, $3) returning id",
      [person, script, version],
    );
    await db.as(translator, "insert into public.story_scenes (script_id, position, scene_kind, title, narration_text) values ($1, 1, 'world', 'x', 'Fixture translated narration')", [t!.id]);
    const [ts] = await db.admin<{ id: string }>("select id from public.story_scenes where script_id = $1", [t!.id]);
    await db.as(editor, "insert into public.scene_claim_references (scene_id, claim_id) values ($1, $2)", [ts!.id, claim]);
    await review("story_script", t!.id);
    await rejects(db.as(translator, "update public.story_scripts set status = 'published' where id = $1", [t!.id]), /linguistic and religious review/);
    const [{ v }] = (await db.admin<{ v: number }>("select version as v from public.story_scripts where id = $1", [t!.id])) as [{ v: number }];
    await rejects(
      db.as(translator, "insert into public.translation_reviews (translated_script_id, script_version, aspect, decision, reviewer_id) values ($1, $2, 'religious', 'approved', $3)", [t!.id, v, translator]),
      /row-level security/,
    );
    await db.as(translator, "insert into public.translation_reviews (translated_script_id, script_version, aspect, decision, reviewer_id) values ($1, $2, 'linguistic', 'approved', $3)", [t!.id, v, translator]);
    await db.as(reviewer, "insert into public.translation_reviews (translated_script_id, script_version, aspect, decision, reviewer_id) values ($1, $2, 'religious', 'approved', $3)", [t!.id, v, reviewer]);
    await db.as(translator, "update public.story_scripts set status = 'published' where id = $1", [t!.id]);
  });

  test("playback preferences and progress belong to their reader only", async () => {
    await db.as(alice, "insert into public.story_playback_preferences (user_id, mode, ambient_volume) values ($1, 'listen', 0.1)", [alice]);
    await rejects(db.as(alice, "insert into public.story_playback_preferences (user_id) values ($1)", [bob]), /row-level security/);
    await rejects(db.as(alice, "update public.story_playback_preferences set ambient_volume = 0.9 where user_id = $1", [alice]), /check constraint/);
    expect(await db.as(bob, "select * from public.story_playback_preferences")).toHaveLength(0);
  });

  test("language preferences: narration and Quran translation languages are checked and private", async () => {
    await db.as(alice, "insert into public.story_playback_preferences (user_id) values ($1) on conflict (user_id) do nothing", [alice]);
    await db.as(alice, "update public.story_playback_preferences set language = 'ur', quran_translation_language = 'none' where user_id = $1", [alice]);
    const [row] = (await db.as<{ language: string; quran_translation_language: string }>(alice, "select language, quran_translation_language from public.story_playback_preferences where user_id = $1", [alice])) as [
      { language: string; quran_translation_language: string },
    ];
    expect(row).toEqual({ language: "ur", quran_translation_language: "none" });
    await rejects(db.as(alice, "update public.story_playback_preferences set quran_translation_language = 'fr' where user_id = $1", [alice]), /check constraint/);
    await rejects(db.as(alice, "update public.story_playback_preferences set language = 'xx' where user_id = $1", [alice]), /check constraint/);
    expect(await db.as(bob, "select * from public.story_playback_preferences where user_id = $1", [alice])).toHaveLength(0);
    await db.as(alice, "update public.profiles set locale = 'ur' where id = $1", [alice]);
    await rejects(db.as(alice, "update public.profiles set locale = 'fr' where id = $1", [alice]), /check constraint/);
  });
});

describe("Creation Atlas", () => {
  test("a known statement needs a claim; 'not established' needs none; a profile publishes only with published entries and a review", async () => {
    const [p] = await db.as<{ id: string }>(editor, "insert into public.creation_profiles (category_id, slug, name_en, name_ar) values ('jinn', 'jinn-fixture', 'Fixture', 'x') returning id");
    await rejects(
      db.as(editor, "insert into public.creation_abilities (profile_id, body_md, evidence_class) values ($1, 'Fixture ability', 'revelation')", [p!.id]),
      /check constraint/,
    );
    await db.as(editor, "insert into public.creation_limitations (profile_id, title, known, evidence_class) values ($1, 'Fixture unknown', false, 'not_established')", [p!.id]);
    const [c] = await db.as<{ id: string }>(
      editor,
      "insert into public.creation_characteristics (profile_id, field_key, body_md, evidence_class, claim_id) values ($1, 'origin', 'Fixture', 'revelation', $2) returning id",
      [p!.id, claim],
    );
    await rejects(db.as(editor, "update public.creation_profiles set status = 'published' where id = $1", [p!.id]), /at least one published/);
    await rejects(db.as(editor, "update public.creation_characteristics set status = 'published' where id = $1", [c!.id]), /no review, no publish/);
    await review("creation", c!.id);
    await db.as(editor, "update public.creation_characteristics set status = 'published' where id = $1", [c!.id]);
    await review("creation", p!.id);
    await db.as(editor, "update public.creation_profiles set status = 'published' where id = $1", [p!.id]);
    expect(await db.as(null, "select id from public.creation_characteristics where profile_id = $1", [p!.id])).toHaveLength(1);
    expect(await db.as(null, "select id from public.creation_limitations where profile_id = $1", [p!.id])).toHaveLength(0); // still draft
  });

  test("visuals can never depict the unseen, and relationships need a claim", async () => {
    await rejects(
      db.as(editor, "insert into public.creation_visual_assets (kind, animation_key, alt_text, depicts_unseen) values ('abstract', 'x', 'Fixture alt', true)"),
      /check constraint/,
    );
    await rejects(
      db.as(editor, "insert into public.creation_relationships (from_kind, from_ref, relation, to_kind, to_ref, evidence_class) values ('creation', 'iblis', 'refused', 'command', 'prostrate', 'revelation')"),
      /null value|not-null/,
    );
  });
});

describe("Mufti Q&A", () => {
  let q: string, priv: string, ans: string;
  test("questions are moderated; private questions are seen only by the asker, assigned muftis and staff", async () => {
    const [a] = await db.as<{ id: string }>(alice, "insert into public.mufti_questions (asker_id, title, body) values ($1, 'Fixture public question', 'A fixture question body long enough.') returning id", [alice]);
    q = a!.id;
    const [b] = await db.as<{ id: string }>(alice, "insert into public.mufti_questions (asker_id, title, body, visibility) values ($1, 'Fixture private question', 'A private fixture question body text.', 'private') returning id", [alice]);
    priv = b!.id;
    expect(await db.as(bob, "select id from public.mufti_questions where id = $1", [q])).toHaveLength(0); // not yet accepted
    await db.as(mod, "update public.mufti_questions set status = 'accepted' where id in ($1, $2)", [q, priv]);
    expect(await db.as(bob, "select id from public.mufti_questions where id = $1", [q])).toHaveLength(1);
    expect(await db.as(bob, "select id from public.mufti_questions where id = $1", [priv])).toHaveLength(0);
    expect(await db.as(alice, "select id from public.mufti_questions where id = $1", [priv])).toHaveLength(1);
  });

  test("only verified, assigned muftis answer; publishing needs a citation and an independent review; edits need a new review", async () => {
    await db.as(mufti, "insert into public.mufti_profiles (user_id, display_name, credentials_md) values ($1, 'Fixture Mufti', 'Fixture credentials')", [mufti]);
    await db.as(mufti2, "insert into public.mufti_profiles (user_id, display_name, credentials_md) values ($1, 'Fixture Mufti 2', 'Fixture credentials')", [mufti2]);
    await rejects(db.as(mufti, "update public.mufti_profiles set verified_by = $1, verified_at = now() where user_id = $1", [mufti]), /row-level security/);
    await rejects(db.as(admin, "insert into public.mufti_assignments (question_id, mufti_id, assigned_by) values ($1, $2, $3)", [q, mufti, admin]), /row-level security/); // not verified yet
    for (const m of [mufti, mufti2]) await db.as(admin, "update public.mufti_profiles set verified_by = $2, verified_at = now() where user_id = $1", [m, admin]);
    await db.as(admin, "insert into public.mufti_assignments (question_id, mufti_id, assigned_by) values ($1, $2, $3)", [q, mufti, admin]);
    await rejects(db.as(mufti2, "insert into public.mufti_answers (question_id, mufti_id, body_md) values ($1, $2, 'Unassigned fixture answer text.')", [q, mufti2]), /assigned to this question/);
    const [x] = await db.as<{ id: string }>(mufti, "insert into public.mufti_answers (question_id, mufti_id, body_md, status) values ($1, $2, 'Fixture answer with enough text.', 'submitted') returning id", [q, mufti]);
    ans = x!.id;
    await rejects(db.as(mufti, "update public.mufti_answers set status = 'published' where id = $1", [ans]), /check constraint|citation/);
    await db.as(mufti, "insert into public.mufti_answer_citations (answer_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 1, 2)", [ans]);
    await rejects(db.as(mufti, "insert into public.mufti_answer_reviews (answer_id, answer_version, reviewer_id, decision) values ($1, 1, $2, 'approved')", [ans, mufti]), /own answer/);
    await db.as(mufti2, "insert into public.mufti_answer_reviews (answer_id, answer_version, reviewer_id, decision) values ($1, 1, $2, 'approved')", [ans, mufti2]);
    await db.as(mufti, "update public.mufti_answers set status = 'published' where id = $1", [ans]);
    expect(await db.as(bob, "select id from public.mufti_answers where id = $1", [ans])).toHaveLength(1);
    await db.as(mufti, "update public.mufti_answers set body_md = 'Fixture answer, edited after review.' where id = $1", [ans]);
    const [after] = await db.admin<{ status: string; review_status: string; version: number }>("select status, review_status, version from public.mufti_answers where id = $1", [ans]);
    expect(after).toEqual({ status: "submitted", review_status: "pending", version: 2 });
    expect(await db.as(bob, "select id from public.mufti_answers where id = $1", [ans])).toHaveLength(0);
  });
});
