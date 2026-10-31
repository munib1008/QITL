// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Shifa (شفاء): evidence layers A–D, the two review pathways, safety notes, the no-dosage text guard, version-bound reviews,
 * no self-review and RLS. Every text below is a labelled test placeholder, never a remedy, health claim, verse or hadith.
 */
const FIXTURE = "[TEST FIXTURE — placeholder, not Quran or hadith text]";
const LIMITS = "[fixture] limits: small study, one species, conflicts declared";

let db: Db;
let editor: string, editor2: string, scholar: string, scientist: string, both: string, alice: string, admin: string;
let quranClaim: string, bukhariClaim: string, tirmidhiHasanClaim: string, tirmidhiSahihClaim: string, scholarClaim: string, draftClaim: string;

async function claim(evidence: "quran" | "hadith" | "scholar", ref: { quran?: boolean; hadith?: string; grading?: string; tafsir?: string }, approve = true): Promise<string> {
  const [c] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence, created_by) values ($1, $2, $3) returning id", [`Fixture claim ${Math.random()}`, evidence, editor]);
  if (ref.quran) await db.as(editor, "insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from) values ($1, 'quran', 12, 3)", [c!.id]);
  if (ref.hadith) await db.as(editor, "insert into public.claim_references (claim_id, kind, hadith_id, hadith_grading_id) values ($1, 'hadith', $2, $3)", [c!.id, ref.hadith, ref.grading ?? null]);
  if (ref.tafsir) await db.as(editor, "insert into public.claim_references (claim_id, kind, source_id, locator) values ($1, 'tafsir', $2, 'vol. 1')", [c!.id, ref.tafsir]);
  if (approve) {
    await db.as(scholar, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('claim', $1, $2, 'approved')", [c!.id, scholar]);
    await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [c!.id]);
  }
  return c!.id;
}

let n = 0;
async function topic(section: string, who = editor): Promise<string> {
  n += 1;
  const [r] = await db.as<{ id: string }>(who, "insert into public.shifa_topics (slug, section, title_en) values ($1, $2, 'Fixture topic') returning id", [`fixture-topic-${n}`, section]);
  return r!.id;
}
async function entry(topicId: string, kind = "practice", who = editor): Promise<string> {
  n += 1;
  const [r] = await db.as<{ id: string }>(who, "insert into public.shifa_entries (topic_id, slug, kind, title_en) values ($1, $2, $3, 'Fixture entry') returning id", [topicId, `fixture-entry-${n}`, kind]);
  return r!.id;
}
const layer = (entryId: string, cat: string, f: Record<string, unknown> = {}, who = editor) => {
  const cols = ["entry_id", "evidence_category", ...Object.keys(f)];
  return db.as<{ id: string }>(who, `insert into public.shifa_layers (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, [entryId, cat, ...Object.values(f)]);
};
const research = { finding: "[fixture] the study reported a result", publication: "Fixture Journal", citation: "Fixture et al., 2020", study_type: "randomised_trial", population: "[fixture] adults", limitations: LIMITS, states_health_effect: true };
const hypothesis = { finding: "[fixture] traditionally associated with a use", is_traditional: true };
const note = (entryId: string, claimId: string, who = editor) =>
  db.as(who, "insert into public.shifa_scholarly_notes (entry_id, claim_id, scholar_name, work_title) values ($1, $2, 'Fixture Scholar', 'Fixture Work')", [entryId, claimId]);
const review = (who: string, type: string, id: string, pathway: "religious" | "clinical", decision = "approved") =>
  db.as(who, "insert into public.shifa_reviews (entity_type, entity_id, pathway, reviewer_id, decision) values ($1, $2, $3, $4, $5)", [type, id, pathway, who, decision]);
const publish = (table: string, id: string, who = editor) => db.as(who, `update public.${table} set status = 'published' where id = $1`, [id]);
const safety = (topicId: string, kind: string, body = "[fixture] a reviewed safety note", entryId: string | null = null) =>
  db.as<{ id: string }>(editor, "insert into public.shifa_safety_notes (topic_id, entry_id, kind, body_en) values ($1, $2, $3, $4) returning id", [topicId, entryId, kind, body]);

/** Publish a safety note: it is clinical (science) reviewed, or religious for a ruling referral. */
async function publishNote(topicId: string, kind: string, entryId: string | null = null) {
  const [s] = await safety(topicId, kind, "[fixture] a reviewed safety note", entryId);
  await review(kind === "ruling_referral" ? scholar : scientist, "shifa_safety_note", s!.id, kind === "ruling_referral" ? "religious" : "clinical");
  await publish("shifa_safety_notes", s!.id);
  return s!.id;
}

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("editor@test.local", ["editor"]);
  editor2 = await db.createUser("editor2@test.local", ["editor"]);
  scholar = await db.createUser("scholar@test.local", ["scholarly_reviewer"]);
  scientist = await db.createUser("scientist@test.local", ["science_reviewer"]);
  both = await db.createUser("both@test.local", ["editor", "scholarly_reviewer", "science_reviewer"]);
  alice = await db.createUser("alice@test.local");
  admin = await db.createUser("admin@test.local", ["admin"]);
  const [{ id: sourceId }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id")) as [{ id: string }];
  const [{ id: tafsirId }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('tafsir', 'Fixture tafsir', 'cleared') returning id")) as [{ id: string }];
  const [{ id: versionId }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [sourceId],
  )) as [{ id: string }];
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (12, 'x', 'Fixture', 111, $1)", [versionId]);
  for (let a = 1; a <= 5; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (12, $1, $2, $3)", [a, FIXTURE, versionId]);
  const hadith = async (collection: string, num: string) =>
    (await db.admin<{ id: string }>("insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic) values ($1, 'fixture', $2, $3, $4) returning id", [collection, num, versionId, FIXTURE]))[0]!.id;
  const grading = async (hid: string, grade: string) =>
    (await db.admin<{ id: string }>("insert into public.hadith_gradings (hadith_id, grader, grade, grade_label, source_id, citation) values ($1, 'Fixture grader', $2, $2, $3, 'fixture') returning id", [hid, grade, sourceId]))[0]!.id;
  const hb = await hadith("bukhari", "1");
  const ht1 = await hadith("tirmidhi", "3");
  const ht2 = await hadith("tirmidhi", "4");
  quranClaim = await claim("quran", { quran: true });
  bukhariClaim = await claim("hadith", { hadith: hb, grading: await grading(hb, "sahih") });
  tirmidhiHasanClaim = await claim("hadith", { hadith: ht1, grading: await grading(ht1, "hasan") });
  tirmidhiSahihClaim = await claim("hadith", { hadith: ht2, grading: await grading(ht2, "sahih") });
  scholarClaim = await claim("scholar", { tafsir: tafsirId });
  draftClaim = await claim("quran", { quran: true }, false);
}, 300_000);

describe("topic shells", () => {
  test("14 draft topics in the four sections, titles only, invisible to the public", async () => {
    const rows = await db.admin<{ section: string; n: number; drafts: number }>(
      "select section, count(*)::int n, count(*) filter (where status = 'draft')::int drafts from public.shifa_topics group by section order by section",
    );
    expect(rows).toEqual([
      { section: "prophetic_remedies", n: 9, drafts: 9 },
      { section: "quranic_healing", n: 1, drafts: 1 },
      { section: "ruqyah", n: 1, drafts: 1 },
      { section: "wellbeing", n: 3, drafts: 3 },
    ]);
    const titles = (await db.admin<{ title_en: string }>("select title_en from public.shifa_topics")).map((t) => t.title_en);
    expect(titles).toEqual(expect.arrayContaining(["Honey", "Black seed (Nigella sativa)", "Dates", "Olive oil", "Water and zamzam", "Cupping (hijama)", "Sleep and rest", "Moderation in eating", "Cleanliness and hygiene", "Grief and distress", "Anxiety and worry", "Patience in illness", "Quranic healing"]));
    for (const t of ["shifa_topics", "shifa_entries", "shifa_layers", "shifa_scholarly_notes", "shifa_safety_notes", "shifa_links"]) {
      expect(await db.as(null, `select 1 from public.${t}`)).toHaveLength(0);
      expect(await db.as(alice, `select 1 from public.${t}`)).toHaveLength(0);
    }
    expect(await db.as(editor, "select 1 from public.shifa_topics")).toHaveLength(14);
    expect(await db.as(scientist, "select 1 from public.shifa_topics")).toHaveLength(14);
    expect(await db.admin("select 1 from public.shifa_entries")).toHaveLength(0);
  });
  test("the tables are registered for the self-review sweep and the entity types exist", async () => {
    const reg = await db.admin<{ entity_type: string; table_name: string }>("select entity_type, table_name from public.review_entity_authors where entity_type like 'shifa_%' order by 1, 2");
    expect(reg.map((r) => r.table_name)).toEqual(["shifa_entries", "shifa_layers", "shifa_scholarly_notes", "shifa_links", "shifa_safety_notes", "shifa_topics"]);
    expect(await db.admin("select 1 from public.review_entity_types where module = 'shifa'")).toHaveLength(4);
  });
});

describe("no dosage, no instruction, no promised cure", () => {
  test("titles, findings, limitations and notes refuse amounts, frequencies, imperatives and guarantees", async () => {
    const t = await topic("prophetic_remedies");
    const e = await entry(t, "remedy");
    await rejects(db.as(editor, "insert into public.shifa_entries (topic_id, slug, kind, title_en) values ($1, 'bad-title', 'remedy', 'Take honey every morning')", [t]), /check constraint/);
    for (const finding of ["[fixture] a trial used 5 g of a preparation", "[fixture] 2 tablespoons were given", "[fixture] taken twice a day", "Drink it first thing", "[fixture] guaranteed benefit", "[fixture] 250 mg per participant"])
      await rejects(layer(e, "C", { ...research, finding }), /check constraint/);
    await rejects(layer(e, "C", { ...research, limitations: "[fixture] one dose of 10 ml was studied" }), /check constraint/);
    await rejects(safety(t, "general", "[fixture] use 3 teaspoons daily"), /check constraint/);
    // Plain reported research and plain safety text are fine.
    await layer(e, "C", { ...research, finding: "[fixture] 40 participants completed the study" });
    await safety(t, "general", "[fixture] ask a clinician or pharmacist first");
  });
});

describe("layer shapes", () => {
  test("A and B hold only their claim; only C may state a health effect; flags belong to D", async () => {
    const e = await entry(await topic("quranic_healing"));
    await rejects(layer(e, "A", { claim_id: quranClaim, finding: "[fixture] free text" }), /check constraint/);
    await rejects(layer(e, "B", { claim_id: bukhariClaim, states_health_effect: true }), /check constraint/);
    await rejects(layer(e, "D", { ...hypothesis, states_health_effect: true }), /check constraint/);
    await rejects(layer(e, "C", { ...research, is_hypothesis: true }), /check constraint/);
    await rejects(layer(e, "D", { ...hypothesis, claim_id: quranClaim }), /check constraint/);
    await rejects(layer(e, "D", { ...hypothesis, study_type: "animal" }), /check constraint/);
  });
});

describe("class A and B need an approved evidence claim", () => {
  async function attempt(cat: "A" | "B", claimId: string | null) {
    const e = await entry(await topic("quranic_healing"));
    await layer(e, cat, claimId ? { claim_id: claimId } : {});
    await review(scholar, "shifa_entry", e, "religious");
    return publish("shifa_entries", e);
  }
  test("a layer without a claim, with an unapproved claim or with the wrong kind of claim is refused", async () => {
    await rejects(attempt("A", null), /needs an approved evidence claim/);
    await rejects(attempt("A", draftClaim), /is not approved/);
    await rejects(attempt("A", bukhariClaim), /class A needs a claim established by a Quran reference/);
    await rejects(attempt("B", quranClaim), /class B needs/);
  });
  test("B accepts Bukhari/Muslim or an individually sahih Tirmidhi/Ibn Majah narration, nothing else", async () => {
    await rejects(attempt("B", tirmidhiHasanClaim), /class B needs/);
    await attempt("B", bukhariClaim);
    await attempt("B", tirmidhiSahihClaim);
    await attempt("A", quranClaim);
  });
});

describe("class C needs the full citation; class D never publishes as established", () => {
  async function remedyWith(cat: "C" | "D", f: Record<string, unknown>) {
    const t = await topic("prophetic_remedies");
    const e = await entry(t, "lifestyle");
    await layer(e, cat, f);
    await publishNote(t, "general");
    await publishNote(t, "interactions");
    await review(scholar, "shifa_entry", e, "religious").catch(() => undefined); // not required for C/D alone in a lifestyle entry? it is: remedies section
    await review(scientist, "shifa_entry", e, "clinical");
    return { e, t };
  }
  test("C is refused without publication, citation, study type, population or limitations", async () => {
    for (const missing of ["publication", "citation", "study_type", "population", "limitations"]) {
      const { e } = await remedyWith("C", { ...research, [missing]: null });
      await rejects(publish("shifa_entries", e), /class C needs|class C must state/);
    }
    const { e } = await remedyWith("C", { ...research, limitations: "too short" });
    await rejects(publish("shifa_entries", e), /must state its limitations/);
  });
  test("C with the full citation publishes after the clinical review", async () => {
    const { e } = await remedyWith("C", research);
    await publish("shifa_entries", e);
    const [r] = await db.admin<{ status: string; last_reviewed_at: string | null }>("select status, last_reviewed_at from public.shifa_entries where id = $1", [e]);
    expect(r!.status).toBe("published");
    expect(r!.last_reviewed_at).not.toBeNull();
  });
  test("D can never publish without its traditional-use or hypothesis flag, and carries no other flag", async () => {
    const { e } = await remedyWith("D", { finding: "[fixture] unflagged statement" });
    await rejects(publish("shifa_entries", e), /flagged as traditional use or hypothesis/);
    const flagged = await remedyWith("D", { finding: "[fixture] hypothesis statement", is_hypothesis: true });
    await publish("shifa_entries", flagged.e);
    const [l] = await db.admin<{ is_hypothesis: boolean; states_health_effect: boolean }>("select is_hypothesis, states_health_effect from public.shifa_layers where entry_id = $1", [flagged.e]);
    expect(l).toEqual({ is_hypothesis: true, states_health_effect: false });
  });
});

describe("two review pathways", () => {
  test("an entry with a Quran layer and a research layer needs the religious AND the clinical review", async () => {
    const t = await topic("quranic_healing");
    const e = await entry(t, "practice");
    await layer(e, "A", { claim_id: quranClaim });
    await layer(e, "C", research);
    await rejects(publish("shifa_entries", e), /needs an approved religious/);
    await review(scholar, "shifa_entry", e, "religious");
    await rejects(publish("shifa_entries", e), /needs an approved clinical/);
    await review(scientist, "shifa_entry", e, "clinical");
    await publish("shifa_entries", e);
  });
  test("a changes-requested verdict blocks until a newer approval", async () => {
    const e = await entry(await topic("quranic_healing"));
    await layer(e, "A", { claim_id: quranClaim });
    await review(scholar, "shifa_entry", e, "religious");
    await review(scholar, "shifa_entry", e, "religious", "changes_requested");
    await rejects(publish("shifa_entries", e), /needs an approved religious/);
    await review(scholar, "shifa_entry", e, "religious");
    await publish("shifa_entries", e);
  });
  test("each pathway needs its own role, and a pathway the record does not need is refused", async () => {
    const e = await entry(await topic("quranic_healing"));
    await layer(e, "A", { claim_id: quranClaim });
    await rejects(review(scientist, "shifa_entry", e, "religious"), /only a scholarly reviewer/);
    await rejects(review(scholar, "shifa_entry", e, "clinical"), /only a science reviewer/);
    await rejects(review(editor, "shifa_entry", e, "religious"), /only a scholarly reviewer/);
    await rejects(review(scientist, "shifa_entry", e, "clinical"), /not required/);
  });
  test("an approval is bound to the version it was given for: editing afterwards makes it stale", async () => {
    const e = await entry(await topic("quranic_healing"));
    await layer(e, "A", { claim_id: quranClaim });
    await review(scholar, "shifa_entry", e, "religious");
    const [before] = await db.admin<{ version: number }>("select version from public.shifa_entries where id = $1", [e]);
    await layer(e, "B", { claim_id: bukhariClaim });
    const [after] = await db.admin<{ version: number }>("select version from public.shifa_entries where id = $1", [e]);
    expect(after!.version).toBeGreaterThan(before!.version);
    await rejects(publish("shifa_entries", e), /needs an approved religious/);
    await review(scholar, "shifa_entry", e, "religious");
    await publish("shifa_entries", e);
  });
  test("a published entry is frozen: neither it nor its layers change until it is moved to correction", async () => {
    const e = await entry(await topic("quranic_healing"));
    const [l] = await layer(e, "A", { claim_id: quranClaim });
    await review(scholar, "shifa_entry", e, "religious");
    await publish("shifa_entries", e);
    await rejects(db.as(editor, "update public.shifa_entries set title_en = 'Changed' where id = $1", [e]), /cannot be edited in place/);
    await rejects(layer(e, "B", { claim_id: bukhariClaim }), /cannot change/);
    await rejects(db.as(editor, "delete from public.shifa_layers where id = $1", [l!.id]), /cannot change/);
    await db.as(editor, "update public.shifa_entries set status = 'correction' where id = $1", [e]);
    await layer(e, "B", { claim_id: bukhariClaim });
  });
});

describe("safety notes", () => {
  test("a remedy page needs published general and interactions notes", async () => {
    const t = await topic("prophetic_remedies");
    const e = await entry(t, "remedy");
    await layer(e, "A", { claim_id: quranClaim });
    await review(scholar, "shifa_entry", e, "religious");
    await review(scientist, "shifa_entry", e, "clinical");
    await rejects(publish("shifa_entries", e), /needs a published general safety note and a published interactions note/);
    await publishNote(t, "general");
    await rejects(publish("shifa_entries", e), /interactions note/);
    // A draft note does not count.
    await safety(t, "interactions");
    await rejects(publish("shifa_entries", e), /interactions note/);
    await publishNote(t, "interactions");
    await publish("shifa_entries", e);
  });
  test("a safety note is clinically reviewed (a ruling referral religiously) and publishes only after it", async () => {
    const t = await topic("prophetic_remedies");
    const [s] = await safety(t, "pregnancy_children");
    await rejects(publish("shifa_safety_notes", s!.id), /needs an approved clinical/);
    await rejects(review(scholar, "shifa_safety_note", s!.id, "religious"), /not required/);
    await review(scientist, "shifa_safety_note", s!.id, "clinical");
    await publish("shifa_safety_notes", s!.id);
    const [r] = await safety(t, "ruling_referral");
    await review(scholar, "shifa_safety_note", r!.id, "religious");
    await publish("shifa_safety_notes", r!.id);
  });
  test("a wellbeing topic needs a published mental-health note and a crisis note", async () => {
    const t = await topic("wellbeing");
    const e = await entry(t, "lesson");
    await layer(e, "A", { claim_id: quranClaim });
    await review(scholar, "shifa_entry", e, "religious");
    await review(scientist, "shifa_entry", e, "clinical");
    await publish("shifa_entries", e);
    await review(scholar, "shifa_topic", t, "religious");
    await review(scientist, "shifa_topic", t, "clinical");
    await rejects(publish("shifa_topics", t), /mental-health note and a published crisis note/);
    await publishNote(t, "mental_health");
    await rejects(publish("shifa_topics", t), /crisis note/);
    await publishNote(t, "crisis");
    await publish("shifa_topics", t);
  });
  test("a topic needs a published entry; a note's entry belongs to its topic", async () => {
    const t = await topic("quranic_healing");
    await review(scholar, "shifa_topic", t, "religious");
    await rejects(publish("shifa_topics", t), /at least one published entry/);
    const other = await topic("quranic_healing");
    const e = await entry(other);
    const [s] = await safety(t, "general", "[fixture] a reviewed safety note", e);
    await review(scientist, "shifa_safety_note", s!.id, "clinical");
    await rejects(publish("shifa_safety_notes", s!.id), /same topic/);
  });
});

describe("ruqyah", () => {
  test("only the Quran and authentic hadith (A/B) and named scholars; the conditions are scholarly notes", async () => {
    const t = await topic("ruqyah");
    const withResearch = await entry(t, "supplication");
    await layer(withResearch, "B", { claim_id: bukhariClaim });
    await layer(withResearch, "C", research);
    await review(scholar, "shifa_entry", withResearch, "religious");
    await review(scientist, "shifa_entry", withResearch, "clinical").catch(() => undefined);
    await rejects(publish("shifa_entries", withResearch), /only on the Quran and authentic hadith/);

    const conditions = await entry(t, "practice");
    await layer(conditions, "A", { claim_id: quranClaim });
    await review(scholar, "shifa_entry", conditions, "religious");
    await rejects(publish("shifa_entries", conditions), /conditions of ruqyah are scholarly claims/);
    await note(conditions, draftClaim);
    await rejects(publish("shifa_entries", conditions), /scholarly claim .* is not approved/);
    await db.as(editor, "delete from public.shifa_scholarly_notes where entry_id = $1", [conditions]);
    await note(conditions, quranClaim);
    await rejects(publish("shifa_entries", conditions), /scholarly interpretation/);
    await db.as(editor, "delete from public.shifa_scholarly_notes where entry_id = $1", [conditions]);
    await note(conditions, scholarClaim);
    await review(scholar, "shifa_entry", conditions, "religious");
    await publish("shifa_entries", conditions);
  });
  test("a supplication needs an A or B layer", async () => {
    const e = await entry(await topic("quranic_healing"), "supplication");
    await note(e, scholarClaim);
    await review(scholar, "shifa_entry", e, "religious");
    await rejects(publish("shifa_entries", e), /supplication comes only from the Quran \(A\) or authentic hadith \(B\)/);
  });
});

describe("no self-review", () => {
  test("the author of an entry, or of any layer or note in it, cannot review it", async () => {
    const e = await entry(await topic("quranic_healing"), "practice", both);
    await layer(e, "A", { claim_id: quranClaim }, both);
    await rejects(review(both, "shifa_entry", e, "religious"), /cannot review their own/);
    await rejects(review(both, "shifa_entry", e, "clinical"), /cannot review their own|not required/);

    // Someone else's layer in my entry taints it for them too.
    const e2 = await entry(await topic("quranic_healing"), "practice", editor);
    await layer(e2, "A", { claim_id: quranClaim }, both);
    await rejects(review(both, "shifa_entry", e2, "religious"), /cannot review their own/);
    await review(scholar, "shifa_entry", e2, "religious");

    // Topics and safety notes too.
    const t = await topic("wellbeing", both);
    await rejects(review(both, "shifa_topic", t, "religious"), /cannot review their own/);
    const [s] = await db.as<{ id: string }>(both, "insert into public.shifa_safety_notes (topic_id, kind, body_en) values ($1, 'crisis', '[fixture] a reviewed safety note') returning id", [t]);
    await rejects(review(both, "shifa_safety_note", s!.id, "clinical"), /cannot review their own/);
  });
  test("the author column is stamped by the database", async () => {
    const [r] = await db.as<{ created_by: string }>(editor, "insert into public.shifa_topics (slug, section, title_en, created_by) values ('stamp-test', 'wellbeing', 'Fixture', $1) returning created_by", [editor2]);
    expect(r!.created_by).toBe(editor);
    const [l] = await db.admin<{ n: number }>("select count(*)::int n from pg_trigger where tgname = 'a0_stamp_author' and tgrelid::regclass::text like 'shifa%'");
    expect(l!.n).toBe(6);
  });
});

describe("visibility", () => {
  test("anon and signed-in readers see only published records of a published topic; editors write drafts only", async () => {
    const t = await topic("quranic_healing");
    const e = await entry(t);
    await layer(e, "A", { claim_id: quranClaim });
    const s = await publishNote(t, "general");
    await review(scholar, "shifa_entry", e, "religious");
    await publish("shifa_entries", e);
    // Entry published, topic still draft: nothing is public (the entry, its layers and the note hide behind the topic).
    for (const who of [null, alice]) {
      expect(await db.as(who, "select 1 from public.shifa_entries where id = $1", [e])).toHaveLength(0);
      expect(await db.as(who, "select 1 from public.shifa_layers where entry_id = $1", [e])).toHaveLength(0);
      expect(await db.as(who, "select 1 from public.shifa_safety_notes where id = $1", [s])).toHaveLength(0);
    }
    await review(scholar, "shifa_topic", t, "religious");
    await publish("shifa_topics", t);
    for (const who of [null, alice]) {
      expect(await db.as(who, "select 1 from public.shifa_topics where id = $1", [t])).toHaveLength(1);
      expect(await db.as(who, "select 1 from public.shifa_entries where id = $1", [e])).toHaveLength(1);
      expect(await db.as(who, "select 1 from public.shifa_layers where entry_id = $1", [e])).toHaveLength(1);
      expect(await db.as(who, "select 1 from public.shifa_safety_notes where id = $1", [s])).toHaveLength(1);
    }
    // A draft entry in a published topic stays hidden; reviews stay staff-only.
    const draft = await entry(t);
    await layer(draft, "A", { claim_id: quranClaim });
    expect(await db.as(alice, "select 1 from public.shifa_entries where id = $1", [draft])).toHaveLength(0);
    expect(await db.as(alice, "select 1 from public.shifa_layers where entry_id = $1", [draft])).toHaveLength(0);
    expect(await db.as(alice, "select 1 from public.shifa_reviews")).toHaveLength(0);
    await rejects(db.as(null, "select 1 from public.shifa_reviews"), /permission denied/);
    expect((await db.as(scholar, "select 1 from public.shifa_reviews")).length).toBeGreaterThan(0);
    // Writes: not for readers, not as published, not by reviewers.
    await rejects(db.as(alice, "insert into public.shifa_topics (slug, section, title_en) values ('x-reader', 'wellbeing', 'Fixture')"), /row-level security/);
    await rejects(db.as(scholar, "insert into public.shifa_entries (topic_id, slug, kind, title_en) values ($1, 'x-rev', 'practice', 'Fixture')", [t]), /row-level security/);
    await rejects(db.as(editor, "insert into public.shifa_topics (slug, section, title_en, status) values ('x-pub', 'wellbeing', 'Fixture', 'published')"), /row-level security|at least one published entry/);
    expect(await db.admin("select 1 from public.shifa_topics where slug = 'x-pub'")).toHaveLength(0);
    await rejects(db.as(null, "insert into public.shifa_layers (entry_id, evidence_category) values ($1, 'A')", [draft]), /permission denied/);
  });
});

describe("links to people, events, stories, Life Guidance topics and foods", () => {
  test("a Life Guidance link is public only when the Shifa topic and the link are published", async () => {
    const [g] = await db.as<{ id: string }>(editor, "insert into public.guidance_topics (slug, title_en, title_ar) values ('shifa-fixture-guidance', 'Fixture guidance', 'x x') returning id");
    const [p] = await db.as<{ id: string }>(editor, "insert into public.people (slug, name_en, name_ar, kind) values ('shifa-fixture-person', 'Fixture', 'x', 'prophet') returning id");
    const t = await topic("wellbeing");
    const e = await entry(t, "lesson");
    await layer(e, "A", { claim_id: quranClaim });
    await review(scholar, "shifa_entry", e, "religious");
    await review(scientist, "shifa_entry", e, "clinical");
    await publish("shifa_entries", e);
    const [gl] = await db.as<{ id: string }>(editor, "insert into public.shifa_links (topic_id, target_kind, guidance_topic_id) values ($1, 'guidance_topic', $2) returning id", [t, g!.id]);
    const [pl] = await db.as<{ id: string }>(editor, "insert into public.shifa_links (topic_id, entry_id, target_kind, person_id) values ($1, $2, 'person', $3) returning id", [t, e, p!.id]);
    await rejects(db.as(editor, "insert into public.shifa_links (topic_id, target_kind, person_id, guidance_topic_id) values ($1, 'person', $2, $3)", [t, p!.id, g!.id]), /check constraint/);
    await rejects(db.as(editor, "insert into public.shifa_links (topic_id, target_kind, guidance_topic_id) values ($1, 'person', $2)", [t, g!.id]), /check constraint/);
    for (const id of [gl!.id, pl!.id]) {
      await review(scholar, "shifa_link", id, "religious");
      await publish("shifa_links", id);
    }
    expect(await db.as(null, "select 1 from public.shifa_links")).toHaveLength(0); // the topic is still a draft
    await publishNote(t, "mental_health");
    await publishNote(t, "crisis");
    await review(scholar, "shifa_topic", t, "religious");
    await review(scientist, "shifa_topic", t, "clinical");
    await publish("shifa_topics", t);
    expect(await db.as(null, "select 1 from public.shifa_links where guidance_topic_id = $1", [g!.id])).toHaveLength(1);
    expect(await db.as(null, "select 1 from public.shifa_links where person_id = $1", [p!.id])).toHaveLength(1);
  });
});
