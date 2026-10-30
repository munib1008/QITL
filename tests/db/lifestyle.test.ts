// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Life Through the Ages: the A–D evidence model, the two review pathways, the non-figurative checks and RLS.
 * Every text below is a test placeholder, never research content.
 */
const FIXTURE = "[TEST FIXTURE — placeholder, not Quran or hadith text]";

let db: Db;
let editor: string, scholar: string, scientist: string, alice: string, admin: string;
let quranClaim: string, bukhariClaim: string, tirmidhiHasanClaim: string, tirmidhiSahihClaim: string, draftClaim: string;

async function claim(evidence: "quran" | "hadith", ref: { quran?: boolean; hadith?: string; grading?: string }, approve = true): Promise<string> {
  const [c] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ($1, $2, $3) returning id", [`Fixture claim ${Math.random()}`, evidence, editor]);
  if (ref.quran) await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 12, 3)", [c!.id]);
  if (ref.hadith) await db.as(editor, "insert into public.claim_references (claim_id, kind, hadith_id, hadith_grading_id) values ($1, 'hadith', $2, $3)", [c!.id, ref.hadith, ref.grading ?? null]);
  if (approve) {
    await db.as(scholar, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [c!.id, scholar]);
    await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [c!.id]);
  }
  return c!.id;
}

const review = (who: string, type: string, id: string, pathway: "religious" | "scientific", decision = "approved") =>
  db.as(who, "insert into public.lifestyle_reviews (entity_type, entity_id, pathway, reviewer_id, decision) values ($1, $2, $3, $4, $5)", [type, id, pathway, who, decision]);

let n = 0;
async function housing(fields: Record<string, unknown>): Promise<string> {
  n += 1;
  const cols = ["slug", "title_en", ...Object.keys(fields)];
  const vals = [`fixture-housing-${n}`, "Fixture record", ...Object.values(fields)];
  const [r] = await db.as<{ id: string }>(editor, `insert into public.historical_housing (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, vals);
  return r!.id;
}
const publish = (table: string, id: string) => db.as(editor, `update public.${table} set status = 'published' where id = $1`, [id]);

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("editor@test.local", ["editor"]);
  scholar = await db.createUser("scholar@test.local", ["scholarly_reviewer"]);
  scientist = await db.createUser("scientist@test.local", ["science_reviewer"]);
  alice = await db.createUser("alice@test.local");
  admin = await db.createUser("admin@test.local", ["admin"]);
  const [{ id: sourceId }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id")) as [{ id: string }];
  const [{ id: versionId }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [sourceId],
  )) as [{ id: string }];
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (12, 'x', 'Fixture', 111, $1)", [versionId]);
  for (let a = 1; a <= 5; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (12, $1, $2, $3)", [a, FIXTURE, versionId]);
  const hadith = async (collection: string, num: string) =>
    (
      await db.admin<{ id: string }>(
        "insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic) values ($1, 'fixture', $2, $3, $4) returning id",
        [collection, num, versionId, FIXTURE],
      )
    )[0]!.id;
  const grading = async (hid: string, grade: string) =>
    (
      await db.admin<{ id: string }>("insert into public.hadith_gradings (hadith_id, grader, grade, grade_label, source_id, citation) values ($1, 'Fixture grader', $2, $2, $3, 'fixture') returning id", [
        hid,
        grade,
        sourceId,
      ])
    )[0]!.id;
  // The claim layer already refuses other collections and unauthentic gradings; class B is stricter still.
  const hb = await hadith("bukhari", "1");
  const ht1 = await hadith("tirmidhi", "3");
  const ht2 = await hadith("tirmidhi", "4");
  quranClaim = await claim("quran", { quran: true });
  bukhariClaim = await claim("hadith", { hadith: hb, grading: await grading(hb, "sahih") });
  tirmidhiHasanClaim = await claim("hadith", { hadith: ht1, grading: await grading(ht1, "hasan") });
  tirmidhiSahihClaim = await claim("hadith", { hadith: ht2, grading: await grading(ht2, "sahih") });
  draftClaim = await claim("quran", { quran: true }, false);
}, 300_000);

describe("profile shells", () => {
  test("25 prophet shells, 20 fields each, all draft and not established, invisible to the public", async () => {
    const [p] = await db.admin<{ n: number; drafts: number }>("select count(*)::int n, count(*) filter (where status = 'draft')::int drafts from public.prophet_lifestyle_profiles");
    expect(p).toEqual({ n: 25, drafts: 25 });
    const [f] = await db.admin<{ n: number; known: number; texts: number; cats: number }>(
      "select count(*)::int n, count(*) filter (where known)::int known, count(*) filter (where body_md <> '')::int texts, count(evidence_category)::int cats from public.prophet_lifestyle_fields",
    );
    expect(f).toEqual({ n: 500, known: 0, texts: 0, cats: 0 });
    expect(await db.as(null, "select id from public.prophet_lifestyle_profiles")).toHaveLength(0);
    expect(await db.as(null, "select id from public.prophet_lifestyle_fields")).toHaveLength(0);
  });
  test("a not-established field cannot carry text or a category", async () => {
    const [p] = await db.admin<{ id: string }>("select id from public.prophet_lifestyle_profiles where person_slug = 'nuh'");
    await rejects(db.as(editor, "insert into public.prophet_lifestyle_fields (profile_id, field_key, position, known, body_md) values ($1, 'lifespan', 2, false, 'x')", [p!.id]), /check constraint/);
    await rejects(db.as(editor, "insert into public.prophet_lifestyle_fields (profile_id, field_key, position, known, evidence_category) values ($1, 'lifespan', 3, false, 'C')", [p!.id]), /check constraint/);
  });
  test("a profile with no published established field cannot be published", async () => {
    const [p] = await db.admin<{ id: string }>("select id from public.prophet_lifestyle_profiles where person_slug = 'hud'");
    await review(scholar, "lifestyle_profile", p!.id, "religious");
    await review(scientist, "lifestyle_profile", p!.id, "scientific");
    await rejects(publish("prophet_lifestyle_profiles", p!.id), /at least one published, established field/);
  });
});

describe("class A and B need an approved evidence claim", () => {
  test("A without a claim, with an unapproved claim, or with a hadith claim is refused", async () => {
    const noClaim = await housing({ evidence_category: "A", confidence: "high" });
    await review(scholar, "lifestyle_housing", noClaim, "religious");
    await rejects(publish("historical_housing", noClaim), /needs an approved evidence claim/);
    const unapproved = await housing({ evidence_category: "A", confidence: "high", claim_id: draftClaim });
    await review(scholar, "lifestyle_housing", unapproved, "religious");
    await rejects(publish("historical_housing", unapproved), /is not approved/);
    const wrong = await housing({ evidence_category: "A", confidence: "high", claim_id: bukhariClaim });
    await review(scholar, "lifestyle_housing", wrong, "religious");
    await rejects(publish("historical_housing", wrong), /class A needs a claim established by a Quran reference/);
  });
  test("A with an approved Quran claim publishes after the religious review only", async () => {
    const id = await housing({ evidence_category: "A", confidence: "high", claim_id: quranClaim });
    await rejects(publish("historical_housing", id), /needs an approved religious/);
    await review(scholar, "lifestyle_housing", id, "religious");
    await publish("historical_housing", id);
    const [r] = await db.as<{ last_reviewed_at: string | null }>(null, "select last_reviewed_at from public.historical_housing where id = $1", [id]);
    expect(r!.last_reviewed_at).not.toBeNull();
  });
  test("B accepts Bukhari/Muslim or an individually sahih Tirmidhi/Ibn Majah narration, nothing else", async () => {
    for (const bad of [tirmidhiHasanClaim, quranClaim]) {
      const id = await housing({ evidence_category: "B", confidence: "high", claim_id: bad });
      await review(scholar, "lifestyle_housing", id, "religious");
      await rejects(publish("historical_housing", id), /class B needs/);
    }
    for (const good of [bukhariClaim, tirmidhiSahihClaim]) {
      const id = await housing({ evidence_category: "B", confidence: "high", claim_id: good });
      await review(scholar, "lifestyle_housing", id, "religious");
      await publish("historical_housing", id);
    }
  });
  test("religious statements are never marked speculative, and a published record states its confidence", async () => {
    await rejects(housing({ evidence_category: "A", confidence: "speculative", claim_id: quranClaim }), /check constraint/);
    const id = await housing({ evidence_category: "A", claim_id: quranClaim });
    await review(scholar, "lifestyle_housing", id, "religious");
    await rejects(publish("historical_housing", id), /confidence/);
  });
});

describe("class C needs a named publication citation", () => {
  test("C without a publication or citation is refused; with both it still needs the science review", async () => {
    const bare = await housing({ evidence_category: "C", confidence: "moderate" });
    await review(scientist, "lifestyle_housing", bare, "scientific");
    await rejects(publish("historical_housing", bare), /named publication citation/);
    const half = await housing({ evidence_category: "C", confidence: "moderate", publication: "Fixture publication" });
    await review(scientist, "lifestyle_housing", half, "scientific");
    await rejects(publish("historical_housing", half), /named publication citation/);
    const full = await housing({ evidence_category: "C", confidence: "moderate", publication: "Fixture publication", primary_citation: "Fixture citation, p. 1" });
    await review(scholar, "lifestyle_housing", full, "religious");
    await rejects(publish("historical_housing", full), /historical\/scientific review/);
    await review(scientist, "lifestyle_housing", full, "scientific");
    await publish("historical_housing", full);
  });
  test("the latest decision counts: changes requested after an approval blocks publishing", async () => {
    const id = await housing({ evidence_category: "C", confidence: "low", publication: "Fixture publication", primary_citation: "Fixture citation" });
    await review(scientist, "lifestyle_housing", id, "scientific");
    await review(scientist, "lifestyle_housing", id, "scientific", "changes_requested");
    await rejects(publish("historical_housing", id), /historical\/scientific review/);
  });
});

describe("class D: reconstructions", () => {
  test("D can never be published without the reconstruction flag", async () => {
    const id = await housing({ evidence_category: "D", confidence: "speculative" });
    await review(scientist, "lifestyle_housing", id, "scientific");
    await rejects(publish("historical_housing", id), /reconstruction flag/);
    await db.as(editor, "update public.historical_housing set is_reconstruction = true where id = $1", [id]);
    await review(scientist, "lifestyle_housing", id, "scientific");
    await publish("historical_housing", id);
  });
  test("only D carries the flag", async () => {
    await rejects(housing({ evidence_category: "C", is_reconstruction: true }), /check constraint/);
  });
  test("the reconstructions table is class D only, and a day is told in parts, never hours", async () => {
    await rejects(
      db.as(editor, "insert into public.historical_reconstructions (slug, kind, title_en, evidence_category) values ('fixture-recon-c', 'day_in_era', 'Fixture', 'C')"),
      /check constraint/,
    );
    await rejects(
      db.as(editor, "insert into public.historical_reconstructions (slug, kind, title_en, evidence_category, is_reconstruction, segments) values ('fixture-recon-h', 'day_in_era', 'Fixture', 'D', true, $1)", [
        JSON.stringify([{ part: "morning", text: "Fixture at 6:30" }]),
      ]),
      /check constraint/,
    );
    await rejects(
      db.as(editor, "insert into public.historical_reconstructions (slug, kind, title_en, evidence_category, is_reconstruction, segments) values ('fixture-recon-p', 'day_in_era', 'Fixture', 'D', true, $1)", [
        JSON.stringify([{ part: "0600", text: "Fixture" }]),
      ]),
      /check constraint/,
    );
    await db.as(editor, "insert into public.historical_reconstructions (slug, kind, title_en, evidence_category, is_reconstruction, segments) values ('fixture-recon-ok', 'day_in_era', 'Fixture', 'D', true, $1)", [
      JSON.stringify([{ part: "dawn", text: "Fixture segment" }]),
    ]);
  });
});

describe("two review pathways", () => {
  test("each pathway belongs to its own role, and nobody reviews their own record", async () => {
    const id = await housing({ evidence_category: "C", confidence: "low", publication: "Fixture publication", primary_citation: "Fixture" });
    await rejects(review(scientist, "lifestyle_housing", id, "religious"), /row-level security|scholarly reviewer/);
    await rejects(review(scholar, "lifestyle_housing", id, "scientific"), /row-level security|science reviewer/);
    await rejects(review(editor, "lifestyle_housing", id, "scientific"), /row-level security|science reviewer/);
    const [own] = await db.as<{ id: string }>(admin, "insert into public.historical_housing (slug, title_en, evidence_category) values ('fixture-admin-own', 'Fixture', 'C') returning id");
    await rejects(review(admin, "lifestyle_housing", own!.id, "scientific"), /their own record/);
  });
  test("a mixed record (a food with a Quran mention and a research link) needs both reviews", async () => {
    const [f] = await db.as<{ id: string }>(
      editor,
      "insert into public.historical_foods (slug, name_en, evidence_category, confidence, publication, primary_citation) values ('fixture-food', 'Fixture food', 'C', 'moderate', 'Fixture publication', 'Fixture citation') returning id",
    );
    await db.as(editor, "insert into public.food_evidence_links (food_id, link_kind, evidence_category, claim_id) values ($1, 'scripture_mention', 'A', $2)", [f!.id, quranClaim]);
    await review(scientist, "lifestyle_food", f!.id, "scientific");
    await rejects(publish("historical_foods", f!.id), /religious \(scholarly\) review/);
    await review(scholar, "lifestyle_food", f!.id, "religious");
    await publish("historical_foods", f!.id);
  });
  test("a profile whose published fields mix A and C needs both reviews", async () => {
    const [p] = await db.admin<{ id: string }>("select id from public.prophet_lifestyle_profiles where person_slug = 'salih'");
    const [a] = await db.as<{ id: string }>(
      editor,
      "update public.prophet_lifestyle_fields set known = true, body_md = 'Fixture A', evidence_category = 'A', claim_id = $2, confidence = 'high' where profile_id = $1 and field_key = 'worship' returning id",
      [p!.id, quranClaim],
    );
    const [c] = await db.as<{ id: string }>(
      editor,
      "update public.prophet_lifestyle_fields set known = true, body_md = 'Fixture C', evidence_category = 'C', publication = 'Fixture publication', primary_citation = 'Fixture citation', confidence = 'low' where profile_id = $1 and field_key = 'climate' returning id",
      [p!.id],
    );
    await review(scholar, "lifestyle_field", a!.id, "religious");
    await publish("prophet_lifestyle_fields", a!.id);
    await review(scientist, "lifestyle_field", c!.id, "scientific");
    await publish("prophet_lifestyle_fields", c!.id);
    await review(scholar, "lifestyle_profile", p!.id, "religious");
    await rejects(publish("prophet_lifestyle_profiles", p!.id), /historical\/scientific review/);
    await review(scientist, "lifestyle_profile", p!.id, "scientific");
    await publish("prophet_lifestyle_profiles", p!.id);
    // Public sees the published fields of a published profile only, never the not-established drafts.
    const rows = await db.as<{ field_key: string }>(null, "select field_key from public.prophet_lifestyle_fields where profile_id = $1 order by field_key", [p!.id]);
    expect(rows.map((r) => r.field_key)).toEqual(["climate", "worship"]);
  });
});

describe("evidence kinds fix the class", () => {
  test("food links: scripture is A, and only modern nutrition research (C) may make a health claim", async () => {
    const [f] = await db.as<{ id: string }>(editor, "insert into public.historical_foods (slug, name_en, evidence_category) values ('fixture-food-2', 'Fixture', 'C') returning id");
    await rejects(db.as(editor, "insert into public.food_evidence_links (food_id, link_kind, evidence_category) values ($1, 'scripture_mention', 'C')", [f!.id]), /check constraint/);
    await rejects(db.as(editor, "insert into public.food_evidence_links (food_id, link_kind, evidence_category, health_claim) values ($1, 'scripture_mention', 'A', true)", [f!.id]), /check constraint/);
    await rejects(db.as(editor, "insert into public.food_evidence_links (food_id, link_kind, evidence_category, health_claim) values ($1, 'hadith_mention', 'B', true)", [f!.id]), /check constraint/);
    await db.as(editor, "insert into public.food_evidence_links (food_id, link_kind, evidence_category, health_claim) values ($1, 'nutrition_research', 'C', true)", [f!.id]);
  });
  test("lifespan claims: kind fixes the class and measure; speculative theories carry no number", async () => {
    const ins = (kind: string, measure: string | null, cat: string, value: number | null = null) =>
      db.as(editor, "insert into public.historical_lifespan_claims (kind, measure, evidence_category, value_years) values ($1, $2, $3, $4)", [kind, measure, cat, value]);
    await rejects(ins("quran_statement", "years_among_people", "C"), /check constraint/);
    await rejects(ins("quran_statement", "life_expectancy_at_birth", "A"), /check constraint/);
    await rejects(ins("modern_verified_max", "total_age", "C"), /check constraint/);
    await rejects(ins("speculative_theory", null, "D", 1), /check constraint/);
    await rejects(ins("speculative_theory", null, "C"), /check constraint/);
    await ins("quran_statement", "years_among_people", "A");
    await ins("speculative_theory", null, "D");
  });
  test("eras carry years only as dated research", async () => {
    await rejects(db.as(editor, "insert into public.historical_eras (slug, name_en, evidence_category, start_year, end_year) values ('fixture-era-a', 'Fixture', 'A', -1000, -900)"), /check constraint/);
    await rejects(db.as(editor, "insert into public.historical_eras (slug, name_en, evidence_category, start_year, end_year) values ('fixture-era-c', 'Fixture', 'C', -1000, -900)"), /check constraint/);
    await db.as(editor, "insert into public.historical_eras (slug, name_en, evidence_category) values ('fixture-era-undated', 'Fixture', 'A')");
  });
});

describe("non-figurative infographics", () => {
  const ins = (extra: string) =>
    db.as(editor, `insert into public.lifestyle_infographics (slug, kind, animation_key, alt_text, evidence_category${extra ? ", " + extra : ""}) values ('fixture-ig-${Math.round(Math.random() * 1e9)}', 'landscape', 'fields', 'Fixture alt', 'D'${extra ? ", true" : ""})`);
  test("never a person, never the unseen, never a prophet's possession", async () => {
    await rejects(ins("depicts_person"), /check constraint/);
    await rejects(ins("depicts_unseen"), /check constraint/);
    await rejects(ins("claims_possession"), /check constraint/);
    await ins("");
  });
});

describe("RLS", () => {
  test("the public reads published rows only; staff and science reviewers read drafts", async () => {
    const id = await housing({ evidence_category: "C" });
    expect(await db.as(null, "select id from public.historical_housing where id = $1", [id])).toHaveLength(0);
    expect(await db.as(alice, "select id from public.historical_housing where id = $1", [id])).toHaveLength(0);
    expect(await db.as(scientist, "select id from public.historical_housing where id = $1", [id])).toHaveLength(1);
    expect(await db.as(scholar, "select id from public.historical_housing where id = $1", [id])).toHaveLength(1);
    expect(await db.as(alice, "select id from public.lifestyle_reviews")).toHaveLength(0);
    expect((await db.as(scientist, "select id from public.lifestyle_reviews")).length).toBeGreaterThan(0);
  });
  test("ordinary users and reviewers cannot write records; nobody inserts straight into 'published'", async () => {
    await rejects(db.as(alice, "insert into public.historical_housing (slug, title_en, evidence_category) values ('fixture-alice', 'x', 'C')"), /row-level security|permission denied/);
    await rejects(db.as(scientist, "insert into public.historical_housing (slug, title_en, evidence_category) values ('fixture-sci', 'x', 'C')"), /row-level security|permission denied/);
    await rejects(db.as(editor, "insert into public.historical_housing (slug, title_en, evidence_category, status) values ('fixture-pub', 'x', 'C', 'published')"), /row-level security|confidence|no review/);
  });
  test("a published record cannot be edited in place", async () => {
    const id = await housing({ evidence_category: "A", confidence: "high", claim_id: quranClaim });
    await review(scholar, "lifestyle_housing", id, "religious");
    await publish("historical_housing", id);
    await rejects(db.as(editor, "update public.historical_housing set body_md = 'changed' where id = $1", [id]), /cannot be edited in place/);
    await db.as(admin, "delete from public.historical_housing where id = $1", [id]); // RLS: published rows are never deleted
    expect(await db.as(null, "select id from public.historical_housing where id = $1", [id])).toHaveLength(1);
  });
  test("review entity types are registered for the module", async () => {
    const rows = await db.admin<{ type: string }>("select type from public.review_entity_types where module = 'life_through_ages'");
    expect(rows).toHaveLength(16);
  });
});
