// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * The Creation Atlas app paths against the database rules they rely on (migration 1400): the admin editor's
 * draft -> in_review -> published flow through /api/admin/status, reviews recorded under the entity type 'creation',
 * visuals published only with an approver (the status route fills approved_by from the latest approval), and the
 * public pages reading only published rows. TEST FIXTURES only: no religious text.
 */

let db: Db;
let editor: string, reviewer: string, claim: string;

const review = (id: string, decision = "approved") =>
  db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('creation', $1, $2, $3)", [id, reviewer, decision]);

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("editor@test.local", ["editor"]);
  reviewer = await db.createUser("reviewer@test.local", ["scholarly_reviewer"]);
  const [{ id: sourceId }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id")) as [{ id: string }];
  const [{ id: versionId }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [sourceId],
  )) as [{ id: string }];
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (1, 'x', 'Fixture', 7, $1)", [versionId]);
  for (let a = 1; a <= 7; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (1, $1, '[TEST FIXTURE]', $2)", [a, versionId]);
  const [c] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ('Fixture claim', 'quran', $1) returning id", [editor]);
  claim = c!.id;
  await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 1, 2)", [claim]);
  await db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [claim, reviewer]);
  await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [claim]);
}, 180_000);

describe("Creation Atlas editor flow", () => {
  test("draft -> in_review -> published for a profile and its entry; drafts stay hidden from the public", async () => {
    const [p] = await db.as<{ id: string }>(editor, "insert into public.creation_profiles (category_id, slug, name_en, name_ar) values ('angels', 'angels', 'Fixture', 'x') returning id");
    const [e] = await db.as<{ id: string; version: number }>(
      editor,
      "insert into public.creation_characteristics (profile_id, field_key, body_md, evidence_class, claim_id) values ($1, 'nature', 'Fixture text', 'revelation', $2) returning id, version",
      [p!.id, claim],
    );
    // Editing a draft raises its version (the editor says so).
    const [v] = await db.as<{ version: number }>(editor, "update public.creation_characteristics set body_md = 'Fixture text 2' where id = $1 returning version", [e!.id]);
    expect(v!.version).toBe(e!.version + 1);
    await db.as(editor, "update public.creation_characteristics set status = 'in_review' where id = $1", [e!.id]);
    expect(await db.as(null, "select id from public.creation_profiles where id = $1", [p!.id])).toHaveLength(0);
    await review(e!.id, "changes_requested");
    await rejects(db.as(editor, "update public.creation_characteristics set status = 'published' where id = $1", [e!.id]), /no review, no publish/);
    await review(e!.id);
    await db.as(editor, "update public.creation_characteristics set status = 'published' where id = $1", [e!.id]);
    // The entry is still hidden while its profile is unpublished.
    expect(await db.as(null, "select id from public.creation_characteristics where id = $1", [e!.id])).toHaveLength(0);
    await review(p!.id);
    await db.as(editor, "update public.creation_profiles set status = 'published' where id = $1", [p!.id]);
    expect(await db.as(null, "select id from public.creation_characteristics where id = $1", [e!.id])).toHaveLength(1);
    // Published rows are never edited in place (the editor hides Edit for them).
    await rejects(db.as(editor, "update public.creation_characteristics set body_md = 'Changed' where id = $1", [e!.id]), /cannot be edited in place/);
  });

  test("relationships and stories publish only with an approved claim and a 'creation' review", async () => {
    const [r] = await db.as<{ id: string }>(
      editor,
      "insert into public.creation_relationships (from_kind, from_ref, relation, to_kind, to_ref, claim_id, evidence_class) values ('creation', 'angels', 'fixture relation', 'concept', 'fixture', $1, 'revelation') returning id",
      [claim],
    );
    await rejects(db.as(editor, "update public.creation_relationships set status = 'published' where id = $1", [r!.id]), /no review, no publish/);
    await review(r!.id);
    await db.as(editor, "update public.creation_relationships set status = 'published' where id = $1", [r!.id]);
    expect(await db.as(null, "select id from public.creation_relationships where id = $1", [r!.id])).toHaveLength(1);

    const [{ id: draftClaim }] = (await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ('Fixture draft claim', 'quran', $1) returning id", [editor])) as [{ id: string }];
    const [s] = await db.as<{ id: string }>(editor, "insert into public.creation_stories (slug, title, claim_id) values ('fixture-story', 'Fixture', $1) returning id", [draftClaim]);
    await review(s!.id);
    await rejects(db.as(editor, "update public.creation_stories set status = 'published' where id = $1", [s!.id]), /no evidence, no publish/);
  });

  test("a visual publishes only with an approver; anonymous visitors cannot write", async () => {
    const [v] = await db.as<{ id: string }>(editor, "insert into public.creation_visual_assets (kind, animation_key, alt_text, profile_id) select 'abstract', 'orbits', 'Fixture alt', id from public.creation_profiles where slug = 'angels' returning id");
    await review(v!.id);
    await rejects(db.as(editor, "update public.creation_visual_assets set status = 'published' where id = $1", [v!.id]), /check constraint/);
    // Migration 1750: the draft-edit version bump needs a version column on visuals, or this update always failed.
    const [pub] = await db.as<{ version: number }>(editor, "update public.creation_visual_assets set status = 'published', approved_by = $2 where id = $1 returning version", [v!.id, reviewer]);
    expect(pub!.version).toBe(2);
    expect(await db.as(null, "select id from public.creation_visual_assets where id = $1", [v!.id])).toHaveLength(1);
    await rejects(db.as(null, "insert into public.creation_profiles (category_id, slug, name_en, name_ar) values ('jinn', 'anon-fixture', 'x', 'x')"), /permission denied|row-level security/);
  });
});
