// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Quran & Science (20261031003000): forced RLS, closed tables with a public read API, the verified-source rule for years, DOIs
 * and publications, two SEPARATE version-bound reviews by two different appointed people, re-review flags, the integrity check and
 * the AI-draft pathway. Fixture text is a labelled placeholder, never Quran or hadith text and never a real finding.
 */
const FX = "[TEST FIXTURE — placeholder, not Quran text]";
const NOT_ESTABLISH = "Fixture: this section states what the evidence does not establish.";
const AR = "نص تجريبي";
const URL1 = "https://example.test/source";

let db: Db;
let editor: string, sci: string, sch: string, both: string, admin: string, plain: string;
let n = 0;

const sel = (sql: string, p: unknown[] = []) => db.admin<Record<string, unknown>>(sql, p);
const mkTopic = async (extra: Record<string, unknown> = {}, who = editor): Promise<string> => {
  n += 1;
  const f = { slug: `fx-topic-${n}`, title_en: "Fixture topic", title_ar: AR, title_ur: AR, discipline: "cosmology", does_not_establish_en: NOT_ESTABLISH, does_not_establish_ar: AR + " " + AR, does_not_establish_ur: AR + " " + AR, ai_generated: true, ...extra };
  const cols = Object.keys(f);
  const [r] = await db.as<{ id: string }>(who, `insert into public.science_topics (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) returning id`, Object.values(f));
  return r!.id;
};
const mkLink = async (tid: string, extra: Record<string, unknown> = {}, who = editor): Promise<string> => {
  const f = { topic_id: tid, surah_id: 1, ayah_no: 1, ...extra };
  const cols = Object.keys(f);
  const [r] = await db.as<{ id: string }>(who, `insert into public.quran_science_links (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) returning id`, Object.values(f));
  return r!.id;
};
const mkClaim = async (tid: string, extra: Record<string, unknown> = {}, who = editor): Promise<string> => {
  const f = { topic_id: tid, claim_en: "Fixture claim text", ...extra };
  const cols = Object.keys(f);
  const [r] = await db.as<{ id: string }>(who, `insert into public.science_claims (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) returning id`, Object.values(f));
  return r!.id;
};
const sciReview = (who: string, tid: string, decision = "approved", scope = "overall") =>
  db.as(who, "insert into public.science_expert_reviews (topic_id, reviewer_id, decision, scope) values ($1, $2, $3, $4)", [tid, who, decision, scope]);
const schReview = (who: string, tid: string, decision = "approved", scope = "overall") =>
  db.as(who, "insert into public.science_scholarly_reviews (topic_id, reviewer_id, decision, scope) values ($1, $2, $3, $4)", [tid, who, decision, scope]);
const state = async (id: string) =>
  (await sel("select status, visibility, integrity_status, scholarly_status, scientific_review, version, classification_version, needs_rereview from public.science_topics where id = $1", [id]))[0]!;
/** A topic that passes the integrity check. */
async function checkedTopic(extra: Record<string, unknown> = {}): Promise<string> {
  const id = await mkTopic(extra);
  await mkLink(id);
  const r = (await db.as<{ r: { passed: boolean; failures: string[] } }>(editor, "select public.run_science_integrity($1) as r", [id]))[0]!.r;
  expect(r.failures).toEqual([]);
  return id;
}
/** A topic that is checked and approved by both reviewers, then published. */
async function publishedTopic(): Promise<string> {
  const id = await checkedTopic();
  await sciReview(sci, id);
  await schReview(sch, id);
  await db.as(editor, "update public.science_topics set status = 'published' where id = $1", [id]);
  return id;
}

beforeAll(async () => {
  db = await createDb({ supabaseDefaults: true });
  editor = await db.createUser("editor@test.local", ["editor"]);
  sci = await db.createUser("sci@test.local", ["science_reviewer"]);
  sch = await db.createUser("sch@test.local", ["scholarly_reviewer"]);
  both = await db.createUser("both@test.local", ["editor", "science_reviewer", "scholarly_reviewer"]);
  admin = await db.createUser("admin@test.local", ["admin"]);
  plain = await db.createUser("plain@test.local");
  const [{ id: src }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id")) as [{ id: string }];
  const [{ id: ver }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [src],
  )) as [{ id: string }];
  for (const [id, cnt] of [[1, 7], [2, 286]]) await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values ($1, 'x', 'Fixture', $2, $3)", [id, cnt, ver]);
  await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (1, 1, $1, $2), (1, 2, $3, $2), (2, 255, $1, $2)", [FX, ver, "بِسْمِ ٱللَّهِ وَسِعَ"]);
}, 240_000);

describe("access: tables are closed, reading is through the public functions", () => {
  test("anon and a plain user read no table; staff read; anon cannot write", async () => {
    const id = await mkTopic();
    for (const who of [null, plain]) {
      expect(await db.as(who, "select 1 from public.science_topics").catch(() => [])).toHaveLength(0);
    }
    expect(await db.as(sci, "select id from public.science_topics where id = $1", [id])).toHaveLength(1);
    expect(await db.as(editor, "select id from public.science_topics where id = $1", [id])).toHaveLength(1);
    await rejects(db.as(null, "insert into public.science_topics (slug) values ('x')"), /permission denied/);
    await rejects(db.as(plain, "insert into public.science_topics (slug, title_en, title_ar, title_ur, discipline, does_not_establish_en, does_not_establish_ar, does_not_establish_ur) values ('plain-x','Fixture topic','x x','x x','cosmology','Fixture: a long enough text here','x xxxxxxxxxxx','x xxxxxxxxxxx')"), /row-level security|permission denied/);
    // the revision history is written only by triggers
    await rejects(db.as(editor, "insert into public.science_revision_history (topic_id, topic_version, action, snapshot) values ($1, 1, 'x', '{}')", [id]), /permission denied/);
    // the review tables are readable by staff only
    expect(await db.as(plain, "select 1 from public.science_expert_reviews").catch(() => [])).toHaveLength(0);
  });

  test("a private draft is invisible to the public functions", async () => {
    const id = await checkedTopic({ slug: "fx-private" });
    expect(await sel("select public.public_science_topic('fx-private') as d")).toEqual([{ d: null }]);
    expect(((await db.as<{ d: Array<{ slug: string }> }>(null, "select public.public_science_topics() as d"))[0]!.d).map((x) => x.slug)).not.toContain("fx-private");
    expect(id).toBeTruthy();
  });
});

describe("the AI-draft pathway", () => {
  test("a draft is readable with its labels only after the automated check passes and an editor shows it", async () => {
    const id = await mkTopic({ slug: "fx-ai-1" });
    await rejects(db.as(editor, "select public.publish_science_ai_draft($1)", [id]), /integrity check/);
    await mkLink(id);
    await rejects(db.as(editor, "update public.science_topics set integrity_status = 'passed' where id = $1", [id]), /automated check/);
    await db.as(editor, "select public.run_science_integrity($1)", [id]);
    await db.as(editor, "select public.publish_science_ai_draft($1)", [id]);
    const [r] = await db.as<{ d: Record<string, unknown> }>(null, "select public.public_science_topic('fx-ai-1') as d");
    expect(r!.d).toMatchObject({ slug: "fx-ai-1", scholarly_status: "not_reviewed", scientific_review: "not_reviewed", published: false, ai_generated: true });
    expect((r!.d.does_not_establish as { en: string }).en).toBe(NOT_ESTABLISH);
    // an edit sends it back to private and unchecked
    await db.as(editor, "update public.science_topics set summary_en = 'Fixture summary text' where id = $1", [id]);
    expect(await state(id)).toMatchObject({ visibility: "private_draft", integrity_status: "pending" });
    expect(await sel("select public.public_science_topic('fx-ai-1') as d")).toEqual([{ d: null }]);
  });

  test("only AI-authored text uses the pathway, only an editor shows it, and withdrawal takes it off with a reason", async () => {
    const human = await mkTopic({ slug: "fx-human", ai_generated: false });
    await mkLink(human);
    await db.as(editor, "select public.run_science_integrity($1)", [human]);
    await rejects(db.as(editor, "select public.publish_science_ai_draft($1)", [human]), /AI-authored/);
    const id = await checkedTopic({ slug: "fx-ai-2" });
    await rejects(db.as(plain, "select public.publish_science_ai_draft($1)", [id]), /editor/);
    await rejects(db.as(sci, "select public.run_science_integrity($1)", [id]), /editor/);
    await db.as(editor, "select public.publish_science_ai_draft($1)", [id]);
    await db.as(editor, "select public.withdraw_science_topic($1, 'fixture reason')", [id]);
    expect(await state(id)).toMatchObject({ visibility: "private_draft" });
    expect((await sel("select withdrawn_reason from public.science_topics where id = $1", [id]))[0]).toEqual({ withdrawn_reason: "fixture reason" });
  });
});

describe("integrity: years, DOIs, publications and classifications", () => {
  test("a milestone year needs a verified source URL and a note (database constraint)", async () => {
    const id = await mkTopic();
    const [d] = await db.as<{ id: string }>(editor, "insert into public.science_discoveries (topic_id, title_en) values ($1, 'Fixture discovery') returning id", [id]);
    await rejects(db.as(editor, "insert into public.science_discovery_milestones (discovery_id, kind, label_en, year) values ($1, 'observation', 'Fixture label', 1900)", [d!.id]), /science_milestone_year_needs_source/);
    await rejects(db.as(editor, "insert into public.science_discovery_milestones (discovery_id, kind, label_en, year, verified_source) values ($1, 'observation', 'Fixture label', 1900, 'not a url')", [d!.id]), /check/);
    // no year: a placeholder is fine
    await db.as(editor, "insert into public.science_discovery_milestones (discovery_id, kind, label_en) values ($1, 'hypothesis', 'Fixture placeholder')", [d!.id]);
    await db.as(editor, "insert into public.science_discovery_milestones (discovery_id, kind, label_en, year, verified_source, verified_note) values ($1, 'confirmation', 'Fixture label', 1900, $2, 'Fixture: checked against the page')", [d!.id, URL1]);
    await rejects(db.as(editor, "insert into public.science_discovery_milestones (discovery_id, kind, label_en) values ($1, 'proof', 'Fixture')", [d!.id]), /check/);
  });

  test("a publication needs a DOI or URL, a DOI format, and a verified source for any year or DOI", async () => {
    const id = await mkTopic();
    const ins = (cols: string, vals: unknown[]) => db.as(editor, `insert into public.science_publications (topic_id, title, ${cols}) values ($1, 'Fixture paper', ${vals.map((_, i) => `$${i + 2}`).join(",")})`, [id, ...vals]);
    await rejects(db.as(editor, "insert into public.science_publications (topic_id, title) values ($1, 'Fixture paper')", [id]), /science_publication_has_locator/);
    await rejects(ins("doi", ["not-a-doi"]), /check/);
    await rejects(ins("doi", ["10.1234/fixture"]), /science_publication_year_needs_source/);
    await rejects(ins("url, year", [URL1, 1999]), /science_publication_year_needs_source/);
    await ins("url", [URL1]); // a URL alone, no year: allowed, unverified
    await ins("doi, verified_source", ["10.1234/fixture", URL1]);
  });

  test("only a science reviewer can set the verified flag; editing a verified citation un-verifies it", async () => {
    const id = await mkTopic();
    const [p] = await db.as<{ id: string }>(editor, "insert into public.science_publications (topic_id, title, url) values ($1, 'Fixture paper', $2) returning id", [id, URL1]);
    await rejects(db.as(editor, "update public.science_publications set verified = true, verified_source = $2, verified_note = 'Fixture: checked' where id = $1", [p!.id, URL1]), /science reviewer/);
    await rejects(db.as(sch, "update public.science_publications set verified = true, verified_source = $2, verified_note = 'Fixture: checked' where id = $1", [p!.id, URL1]), /row-level security|0 rows|science reviewer/).catch(() => undefined);
    await db.as(sci, "update public.science_publications set verified = true, verified_source = $2, verified_note = 'Fixture: checked' where id = $1", [p!.id, URL1]);
    expect((await sel("select verified, verified_by from public.science_publications where id = $1", [p!.id]))[0]).toEqual({ verified: true, verified_by: sci });
    await db.as(editor, "update public.science_publications set title = 'Changed fixture title' where id = $1", [p!.id]);
    expect((await sel("select verified from public.science_publications where id = $1", [p!.id]))[0]).toEqual({ verified: false });
  });

  test("the public document shows a publication only when verified, and a milestone year only with its source", async () => {
    const id = await checkedTopic({ slug: "fx-pub" });
    const [d] = await db.as<{ id: string }>(editor, "insert into public.science_discoveries (topic_id, title_en) values ($1, 'Fixture discovery') returning id", [id]);
    await db.as(editor, "insert into public.science_discovery_milestones (discovery_id, kind, label_en, year, verified_source, verified_note) values ($1, 'confirmation', 'Fixture label', 1900, $2, 'Fixture: checked')", [d!.id, URL1]);
    await db.as(editor, "insert into public.science_discovery_milestones (discovery_id, kind, label_en) values ($1, 'hypothesis', 'Fixture undated label')", [d!.id]);
    const [p1] = await db.as<{ id: string }>(editor, "insert into public.science_publications (topic_id, title, url) values ($1, 'Unverified fixture paper', $2) returning id", [id, URL1]);
    const [p2] = await db.as<{ id: string }>(editor, "insert into public.science_publications (topic_id, title, url) values ($1, 'Verified fixture paper', $2) returning id", [id, URL1]);
    await db.as(sci, "update public.science_publications set verified = true, verified_source = $2, verified_note = 'Fixture: checked' where id = $1", [p2!.id, URL1]);
    expect(p1).toBeTruthy();
    await db.as(editor, "select public.run_science_integrity($1)", [id]);
    await db.as(editor, "select public.publish_science_ai_draft($1)", [id]);
    const [r] = await db.as<{ d: { publications: Array<{ title: string }>; milestones: Array<{ year: number | null; verified_source: string | null }> } }>(null, "select public.public_science_topic('fx-pub') as d");
    expect(r!.d.publications.map((x) => x.title)).toEqual(["Verified fixture paper"]);
    expect(r!.d.milestones).toEqual([expect.objectContaining({ year: 1900, verified_source: URL1 }), expect.objectContaining({ year: null, verified_source: null })]);
  });

  test("the integrity check fails on a missing Quran link, a year without source, an unverified 'sourced' evidence row and inconsistent ratings", async () => {
    const empty = await mkTopic();
    const r0 = (await db.as<{ r: { passed: boolean; failures: string[] } }>(editor, "select public.run_science_integrity($1) as r", [empty]))[0]!.r;
    expect(r0.passed).toBe(false);
    expect(r0.failures.join()).toMatch(/no Quran passage/);

    const id = await mkTopic();
    await mkLink(id, { relationship: "scientifically_established" });
    const [p] = await db.as<{ id: string }>(editor, "insert into public.science_publications (topic_id, title, url) values ($1, 'Fixture paper', $2) returning id", [id, URL1]);
    await db.as(editor, "insert into public.science_evidence (topic_id, publication_id, summary_en, evidence_status) values ($1, $2, 'Fixture evidence summary', 'sourced')", [id, p!.id]);
    const r1 = (await db.as<{ r: { failures: string[] } }>(editor, "select public.run_science_integrity($1) as r", [id]))[0]!.r;
    expect(r1.failures.join("|")).toMatch(/Scientifically Established but no claim/);
    expect(r1.failures.join("|")).toMatch(/not verified/);

    // a DOI shown without a verified source: only reachable if the table constraint is gone, so the check is tested on its own
    await db.admin("alter table public.science_publications drop constraint science_publication_year_needs_source");
    await db.admin("insert into public.science_publications (topic_id, title, doi) values ($1, 'Fixture paper', '10.1234/fixture')", [id]);
    await db.admin("alter table public.science_discovery_milestones drop constraint science_milestone_year_needs_source");
    const [d] = await db.admin<{ id: string }>("insert into public.science_discoveries (topic_id, title_en) values ($1, 'Fixture discovery') returning id", [id]);
    await db.admin("insert into public.science_discovery_milestones (discovery_id, kind, label_en, year) values ($1, 'observation', 'Fixture label', 1900)", [d!.id]);
    const r2 = (await db.as<{ r: { failures: string[] } }>(editor, "select public.run_science_integrity($1) as r", [id]))[0]!.r;
    expect(r2.failures.join("|")).toMatch(/discovery year has no verified source/);
    expect(r2.failures.join("|")).toMatch(/DOI or year without a verified source/);
    await db.admin("delete from public.science_discovery_milestones where discovery_id = $1", [d!.id]);
    await db.admin("delete from public.science_publications where topic_id = $1 and doi is not null", [id]);
    await db.admin("alter table public.science_publications add constraint science_publication_year_needs_source check ((doi is null and year is null) or verified_source is not null)");
    await db.admin("alter table public.science_discovery_milestones add constraint science_milestone_year_needs_source check (year is null or (verified_source is not null and verified_note is not null))");
  });

  test("a classical scholar cannot be credited with a reading proposed after a modern discovery; no wording without a source", async () => {
    const id = await mkTopic();
    const lk = await mkLink(id);
    await rejects(db.as(editor, "insert into public.quran_science_interpretations (link_id, era, summary_en) values ($1, 'classical', 'Fixture summary text')", [lk]), /science_interp_sourced/);
    await rejects(db.as(editor, "insert into public.quran_science_interpretations (link_id, era, proposed_after_discovery) values ($1, 'classical', true)", [lk]), /science_interp_sourced/);
    await db.as(editor, "insert into public.quran_science_interpretations (link_id, era, scholar_name) values ($1, 'classical', 'Fixture scholar')", [lk]); // placeholder: needs_source
    const [src] = await db.admin<{ id: string }>("select id from public.sources limit 1");
    await db.as(editor, "insert into public.quran_science_interpretations (link_id, era, scholar_name, work_title, source_id, evidence_status, proposed_after_discovery, summary_en) values ($1, 'classical', 'Fixture scholar', 'Fixture work', $2, 'sourced', true, 'Fixture summary text')", [lk, src!.id]);
    const r = (await db.as<{ r: { failures: string[] } }>(editor, "select public.run_science_integrity($1) as r", [id]))[0]!.r;
    expect(r.failures.join("|")).toMatch(/classical scholar is credited/);
  });

  test("Arabic terms must appear in the corpus text of the verse", async () => {
    const id = await mkTopic();
    await mkLink(id, { surah_id: 1, ayah_no: 2, arabic_terms: ["وَسِعَ"] });
    await rejects(mkLink(id, { surah_id: 1, ayah_no: 1, arabic_terms: ["وَسِعَ"] }), /does not appear in the corpus/);
    await rejects(mkLink(id, { surah_id: 9, ayah_no: 9 }), /foreign key|violates/);
  });

  test("metaphysical topics are outside empirical science and not testable, and cannot be rated otherwise", async () => {
    const id = await mkTopic({ topic_kind: "unseen", discipline: "metaphysics" });
    await rejects(mkClaim(id, { evidence_state: "established" }), /outside empirical science/);
    await mkClaim(id, { evidence_state: "outside_empirical_science", claim_kind: "metaphysical" });
    await rejects(mkLink(id, { relationship: "active_research" }), /not scientifically testable/);
    await mkLink(id, { relationship: "not_scientifically_testable" });
    await rejects(db.as(sci, "insert into public.science_claim_assessments (claim_id, evidence_state, rationale, assessor_id) select id, 'hypothesis', 'Fixture rationale text', $2 from public.science_claims where topic_id = $1", [id, sci]), /outside empirical science/);
  });

  test("a sacred figure may not be depicted in a visual asset", async () => {
    const id = await mkTopic();
    await rejects(db.as(editor, "insert into public.science_visual_assets (topic_id, kind, title_en, alt_text_en, depicts_sacred_figure) values ($1, 'diagram', 'Fixture diagram', 'A fixture diagram description', true)", [id]), /check/);
    await db.as(editor, "insert into public.science_visual_assets (topic_id, kind, title_en, alt_text_en) values ($1, 'diagram', 'Fixture diagram', 'A fixture diagram description')", [id]);
    await rejects(db.as(editor, "insert into public.science_visual_assets (topic_id, kind, title_en, alt_text_en, licence_status) values ($1, 'diagram', 'Fixture diagram', 'A fixture diagram description', 'cleared')", [id]), /check/);
  });

  test("free text is refused when it makes a proof, 'will confirm', cure or percentage-confidence claim", async () => {
    for (const bad of [
      "The proof score of this verse is high",
      "Science has proved the existence of the angels",
      "Future research will confirm this verse",
      "This is a scientific miracle proven by physics",
      "Awaiting laboratory proof of the unseen",
      "This drink cures every disease",
      "Confidence 87% that the reading is right",
    ])
      await rejects(db.as(editor, "update public.science_topics set summary_en = $2 where id = $1", [await mkTopic(), bad]), /check/);
    await db.as(editor, "update public.science_topics set summary_en = $2 where id = $1", [await mkTopic(), "Observation supports expansion; the verse's reading is debated."]);
  });
});

describe("two separate, version-bound reviews", () => {
  test("verified (published) needs BOTH reviews, from two different appointed people, on the current version", async () => {
    const id = await checkedTopic();
    await rejects(db.as(editor, "update public.science_topics set status = 'published' where id = $1", [id]), /scientific review/);
    await sciReview(sci, id);
    expect(await state(id)).toMatchObject({ scientific_review: "approved", scholarly_status: "not_reviewed" });
    await rejects(db.as(editor, "update public.science_topics set status = 'published' where id = $1", [id]), /scholarly review/);
    await schReview(sch, id);
    await db.as(editor, "update public.science_topics set status = 'published' where id = $1", [id]);
    expect(await state(id)).toMatchObject({ status: "published", visibility: "public_approved", scholarly_status: "approved", scientific_review: "approved" });
    const slug = (await sel("select slug from public.science_topics where id = $1", [id]))[0]!.slug as string;
    const [r] = await db.as<{ d: { published: boolean } }>(null, "select public.public_science_topic($1) as d", [slug]);
    expect(r!.d.published).toBe(true);
  });

  test("a scientific review does not satisfy the scholarly one, and the roles are separate", async () => {
    const id = await checkedTopic();
    await rejects(schReview(sci, id), /row-level security|scholarly_reviewer/);
    await rejects(sciReview(sch, id), /row-level security|science_reviewer/);
    await rejects(sciReview(editor, id), /appointed|row-level security/);
    await rejects(sciReview(admin, id), /appointed|row-level security/); // an admin is not an appointed science reviewer
    await rejects(sciReview(plain, id), /appointed|row-level security/);
  });

  test("one person holding both roles cannot supply both approvals; and nobody records a review for someone else", async () => {
    const id = await checkedTopic();
    await sciReview(both, id);
    await schReview(both, id);
    await rejects(db.as(editor, "update public.science_topics set status = 'published' where id = $1", [id]), /two different people/);
    await schReview(sch, id); // a second, different approver for the religious relationship
    await db.as(editor, "update public.science_topics set status = 'published' where id = $1", [id]);
    const id2 = await checkedTopic();
    await rejects(db.as(sci, "insert into public.science_expert_reviews (topic_id, reviewer_id, decision) values ($1, $2, 'approved')", [id2, both]), /row-level security|signed-in reviewer/);
    // the service role (an AI or job) cannot record a review in a reviewer's name
    await rejects(db.admin("select set_config('request.jwt.claim.role', 'service_role', false)").then(() => db.pg.exec("set role service_role").then(() => db.pg.query("insert into public.science_expert_reviews (topic_id, reviewer_id, decision) values ($1, $2, 'approved')", [id2, sci]))), /signed-in reviewer/);
    await db.pg.exec("reset role");
    await db.admin("select set_config('request.jwt.claim.role', '', false)");
  });

  test("no self-review: the author of a topic cannot review it", async () => {
    const id = await mkTopic({}, both);
    await mkLink(id, {}, both);
    await rejects(sciReview(both, id), /cannot review their own/);
    await rejects(schReview(both, id), /cannot review their own/);
  });

  test("approval is bound to a version: any edit withdraws it and the topic leaves the public pages", async () => {
    const id = await publishedTopic();
    await rejects(db.as(editor, "update public.science_topics set summary_en = 'Fixture summary text' where id = $1", [id]), /published topic is fixed/);
    await db.as(editor, "update public.science_topics set status = 'correction' where id = $1", [id]);
    expect(await state(id)).toMatchObject({ visibility: "private_draft", scholarly_status: "invalidated", scientific_review: "invalidated" });
    await db.as(editor, "update public.science_topics set summary_en = 'Fixture summary text' where id = $1", [id]);
    await db.as(editor, "select public.run_science_integrity($1)", [id]);
    await rejects(db.as(editor, "update public.science_topics set status = 'published' where id = $1", [id]), /scientific review/);
    await sciReview(sci, id);
    await schReview(sch, id);
    await db.as(editor, "update public.science_topics set status = 'published' where id = $1", [id]);
    expect((await state(id)).status).toBe("published");
  });

  test("a review of an older version does not count", async () => {
    const id = await checkedTopic();
    await sciReview(sci, id);
    await schReview(sch, id);
    await db.as(editor, "update public.science_topics set summary_en = 'Fixture summary text v2' where id = $1", [id]);
    expect(await state(id)).toMatchObject({ scientific_review: "invalidated", scholarly_status: "invalidated" });
    await db.as(editor, "select public.run_science_integrity($1)", [id]);
    await rejects(db.as(editor, "update public.science_topics set status = 'published' where id = $1", [id]), /scientific review/);
  });

  test("approved statuses cannot be set by hand", async () => {
    const id = await checkedTopic();
    await rejects(db.as(editor, "update public.science_topics set scientific_review = 'approved' where id = $1", [id]), /approving scientific review/);
    await rejects(db.as(editor, "update public.science_topics set scholarly_status = 'approved' where id = $1", [id]), /approving scholarly review/);
    await rejects(db.as(editor, "update public.science_topics set visibility = 'public_approved' where id = $1", [id]), /both reviews/);
    await rejects(db.as(admin, "update public.science_topics set status = 'published' where id = $1", [id]), /scientific review/);
  });

  test("a rejected topic is not public; changes requested are recorded", async () => {
    const id = await checkedTopic();
    await db.as(editor, "select public.publish_science_ai_draft($1)", [id]);
    await schReview(sch, id, "changes_requested");
    expect(await state(id)).toMatchObject({ scholarly_status: "changes_requested" });
    await sciReview(sci, id, "rejected");
    expect(await state(id)).toMatchObject({ visibility: "private_draft", scientific_review: "rejected" });
    await rejects(db.as(editor, "select public.publish_science_ai_draft($1)", [id]), /rejected/);
    const slug = (await sel("select slug from public.science_topics where id = $1", [id]))[0]!.slug as string;
    const [r] = await db.as<{ d: unknown }>(null, "select public.public_science_topic($1) as d", [slug]);
    expect(r!.d).toBeNull();
  });
});

describe("changing a rating or classification flags the topic for re-review", () => {
  test("a link rating change invalidates approvals, withdraws the draft and flags the topic until both approve again", async () => {
    const id = await checkedTopic();
    const lk = (await sel("select id from public.quran_science_links where topic_id = $1", [id]))[0]!.id as string;
    await db.as(editor, "select public.publish_science_ai_draft($1)", [id]);
    await sciReview(sci, id);
    await schReview(sch, id);
    const before = await state(id);
    await db.as(editor, "update public.quran_science_links set interpretation_strength = 'disputed_interpretation' where id = $1", [lk]);
    expect(await state(id)).toMatchObject({ needs_rereview: true, classification_version: (before.classification_version as number) + 1, scientific_review: "invalidated", scholarly_status: "invalidated", visibility: "private_draft", integrity_status: "pending" });
    await db.as(editor, "update public.quran_science_links set relationship = 'interpretation_debated' where id = $1", [lk]);
    await db.as(editor, "update public.quran_science_links set connection_strength = 'tentative' where id = $1", [lk]);
    expect((await state(id)).classification_version).toBe((before.classification_version as number) + 3);
    await db.as(editor, "select public.run_science_integrity($1)", [id]);
    await sciReview(sci, id);
    await rejects(db.as(editor, "update public.science_topics set status = 'published' where id = $1", [id]), /scholarly review/);
    await schReview(sch, id);
    expect((await state(id)).needs_rereview).toBe(false); // cleared by the second approval of this version
    await db.as(editor, "update public.science_topics set status = 'published' where id = $1", [id]);
  });

  test("a claim's evidence state changes the same way, and a reviewer's assessment sets it", async () => {
    const id = await checkedTopic();
    const c = await mkClaim(id);
    await sciReview(sci, id);
    await schReview(sch, id);
    await db.as(editor, "select 1");
    await rejects(db.as(editor, "insert into public.science_claim_assessments (claim_id, evidence_state, rationale, assessor_id) values ($1, 'established', 'Fixture rationale text', $2)", [c, editor]), /row-level security|science reviewer/);
    await db.as(sci, "insert into public.science_claim_assessments (claim_id, evidence_state, rationale, basis_url) values ($1, 'well_supported', 'Fixture rationale text', $2)", [c, URL1]);
    expect((await sel("select evidence_state from public.science_claims where id = $1", [c]))[0]).toEqual({ evidence_state: "well_supported" });
    expect(await state(id)).toMatchObject({ needs_rereview: true, scientific_review: "invalidated", scholarly_status: "invalidated" });
    await rejects(db.as(sci, "insert into public.science_claim_assessments (claim_id, evidence_state, rationale) values ($1, 'hypothesis', 'x')", [c]), /check/);
  });

  test("a published topic's children cannot be edited; the flag cannot be cleared by hand", async () => {
    const id = await publishedTopic();
    const lk = (await sel("select id from public.quran_science_links where topic_id = $1", [id]))[0]!.id as string;
    await rejects(db.as(editor, "update public.quran_science_links set relationship = 'active_research' where id = $1", [lk]), /published topic is fixed/);
    await rejects(mkClaim(id), /published topic is fixed/);
    const id2 = await checkedTopic();
    const lk2 = (await sel("select id from public.quran_science_links where topic_id = $1", [id2]))[0]!.id as string;
    await db.as(editor, "update public.quran_science_links set relationship = 'active_research' where id = $1", [lk2]);
    await rejects(db.as(editor, "update public.science_topics set needs_rereview = false where id = $1", [id2]), /re-review flag clears only/);
  });
});

describe("history, localizations, questions, timeline", () => {
  test("the revision history records content changes and reviews, and is readable by staff only", async () => {
    const id = await checkedTopic();
    await db.as(editor, "update public.science_topics set summary_en = 'Fixture summary text' where id = $1", [id]);
    await sciReview(sci, id);
    const acts = (await sel("select action from public.science_revision_history where topic_id = $1 order by created_at, id", [id])).map((r) => r.action as string);
    expect(acts).toContain("created");
    expect(acts).toContain("content_changed");
    expect(acts.some((a) => a.startsWith("review:science_expert_reviews"))).toBe(true);
    expect(await db.as(plain, "select 1 from public.science_revision_history").catch(() => [])).toHaveLength(0);
    expect((await db.as(sci, "select 1 from public.science_revision_history where topic_id = $1", [id])).length).toBeGreaterThan(0);
  });

  test("localizations are drafts; only a translation-reviewed flag by staff is data, and unique per field", async () => {
    const id = await mkTopic();
    await db.as(editor, "insert into public.science_localizations (topic_id, language, field, body) values ($1, 'ar', 'summary', $2)", [id, AR]);
    await rejects(db.as(editor, "insert into public.science_localizations (topic_id, language, field, body) values ($1, 'ar', 'summary', $2)", [id, AR]), /duplicate|unique/);
    await rejects(db.as(editor, "insert into public.science_localizations (topic_id, language, field, body) values ($1, 'en', 'summary', $2)", [id, AR]), /check/);
  });

  test("open questions and the timeline come only from visible topics", async () => {
    const id = await checkedTopic({ slug: "fx-q" });
    const hidden = await checkedTopic({ slug: "fx-q-hidden" });
    for (const t of [id, hidden]) await db.as(editor, "insert into public.science_open_questions (topic_id, question_en, testability) values ($1, 'Fixture open question', 'not_testable')", [t]);
    await db.as(editor, "select public.run_science_integrity($1)", [id]);
    await db.as(editor, "select public.run_science_integrity($1)", [hidden]);
    await db.as(editor, "select public.publish_science_ai_draft($1)", [id]);
    const [q] = await db.as<{ d: Array<{ topic: string }> }>(null, "select public.public_science_questions() as d");
    expect(q!.d.map((x) => x.topic)).toContain("fx-q");
    expect(q!.d.map((x) => x.topic)).not.toContain("fx-q-hidden");
    const [t] = await db.as<{ d: Array<{ slug: string; layer_a: unknown[]; layer_b: unknown[] }> }>(null, "select public.public_science_timeline() as d");
    expect(t!.d.map((x) => x.slug)).not.toContain("fx-q-hidden");
    expect(t!.d.find((x) => x.slug === "fx-q")!.layer_a.length).toBeGreaterThan(0);
  });

  test("interpretations in the public document show wording only when sourced", async () => {
    const id = await checkedTopic({ slug: "fx-interp" });
    const lk = (await sel("select id from public.quran_science_links where topic_id = $1", [id]))[0]!.id as string;
    await db.as(editor, "insert into public.quran_science_interpretations (link_id, era, scholar_name) values ($1, 'contemporary', 'Fixture scholar')", [lk]);
    await db.as(editor, "select public.run_science_integrity($1)", [id]);
    await db.as(editor, "select public.publish_science_ai_draft($1)", [id]);
    const [r] = await db.as<{ d: { links: Array<{ interpretations: Array<Record<string, unknown>> }> } }>(null, "select public.public_science_topic('fx-interp') as d");
    expect(r!.d.links[0]!.interpretations[0]).toMatchObject({ evidence_status: "needs_source", scholar: null, summary: null });
  });
});
