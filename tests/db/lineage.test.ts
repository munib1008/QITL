// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";
import { deriveEvidenceClass, LINEAGE_CLASSES } from "@/lib/lineage/classes";
import type { EvidenceKind } from "@/content/labels";

/**
 * The Lineage of Humanity and the scripture witness registry (migrations 20261031002640..002642): evidence class
 * derivation (database and TypeScript agree), gap nodes and node claims (cited, reviewed, frozen once published),
 * the witness registry (mandatory limitation, no scripture text, two review pathways), and public counts.
 * Fixture text is a labelled placeholder, never religious text.
 */
const FIXTURE = "[TEST FIXTURE — placeholder, not Quran or hadith text]";

let db: Db;
let editor: string, reviewer: string, scientist: string, admin: string, alice: string, editorReviewer: string;
let sourceId: string, versionId: string, hadithId: string, gradingId: string, witnessId: string;
let n = 0;

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("ln-editor@test.local", ["editor"]);
  reviewer = await db.createUser("ln-reviewer@test.local", ["scholarly_reviewer"]);
  scientist = await db.createUser("ln-scientist@test.local", ["science_reviewer"]);
  admin = await db.createUser("ln-admin@test.local", ["admin"]);
  alice = await db.createUser("ln-alice@test.local");
  editorReviewer = await db.createUser("ln-both@test.local", ["editor", "scholarly_reviewer"]);
  [{ id: sourceId }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status, source_url) values ('history', 'Test publication', 'cleared', 'https://example.test') returning id")) as [{ id: string }];
  [{ id: versionId }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [sourceId],
  )) as [{ id: string }];
  await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values (12, 'x', 'Fixture', 111, $1)", [versionId]);
  for (let a = 1; a <= 5; a++) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values (12, $1, $2, $3)", [a, FIXTURE, versionId]);
  [{ id: hadithId }] = (await db.admin<{ id: string }>(
    "insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic) values ('bukhari', 'fixture', '9001', $1, $2) returning id",
    [versionId, FIXTURE],
  )) as [{ id: string }];
  [{ id: gradingId }] = (await db.admin<{ id: string }>(
    "insert into public.hadith_gradings (hadith_id, grader, grade, grade_label, source_id, citation) values ($1, 'Fixture grader', 'sahih', 'sahih', $2, 'fixture') returning id",
    [hadithId, sourceId],
  )) as [{ id: string }];
}, 240_000);

const review = (type: string, id: string, who = reviewer) =>
  db.as(who, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ($1, $2, $3, 'approved')", [type, id, who]);

type Ref = "quran" | "hadith" | "tafsir" | "scholar" | "history" | "scripture";
async function addRef(claim: string, kind: Ref, wid?: string) {
  const q: Record<Ref, [string, unknown[]]> = {
    quran: ["insert into public.claim_references (claim_id, kind, quran_surah, quran_ayah_from, quran_ayah_to) values ($1, 'quran', 12, 4, 5)", [claim]],
    hadith: ["insert into public.claim_references (claim_id, kind, hadith_id, hadith_grading_id) values ($1, 'hadith', $2, $3)", [claim, hadithId, gradingId]],
    tafsir: ["insert into public.claim_references (claim_id, kind, source_id, locator) values ($1, 'tafsir', $2, 'vol. 1')", [claim, sourceId]],
    scholar: ["insert into public.claim_references (claim_id, kind, source_id, locator) values ($1, 'scholar', $2, 'p. 3')", [claim, sourceId]],
    history: ["insert into public.claim_references (claim_id, kind, source_id, locator) values ($1, 'history', $2, 'p. 9')", [claim, sourceId]],
    scripture: ["insert into public.claim_references (claim_id, kind, scripture_witness_id, locator) values ($1, 'scripture', $2, 'Fixture 5:3')", [claim, wid ?? witnessId]],
  };
  await db.as(editor, q[kind][0], q[kind][1]);
}

/** A claim with the given evidence label and references; approved (reviewed) when `approve`. */
async function claim(evidence: EvidenceKind, refs: Ref[], approve = true): Promise<string> {
  const [c] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence) values ($1, $2) returning id", [`Fixture lineage claim ${++n} for the tests`, evidence]);
  for (const r of refs) await addRef(c!.id, r);
  if (approve) {
    await review("claim", c!.id);
    await db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [c!.id]);
  }
  return c!.id;
}

async function person(slug: string, published = true): Promise<string> {
  const [p] = await db.as<{ id: string }>(editor, "insert into public.people (slug, name_en, name_ar, kind) values ($1, $2, 'x', 'prophet') returning id", [slug, `Fixture ${slug}`]);
  if (published) {
    await review("person", p!.id);
    await db.admin("update public.people set status = 'published' where id = $1", [p!.id]);
  }
  return p!.id;
}

async function publishedWitness(slug: string): Promise<string> {
  const [w] = await db.as<{ id: string }>(
    editor,
    `insert into public.scripture_witnesses (slug, layer, kind, name_en, language, what_it_is, limitation)
     values ($1, 'tawrah', 'codex', 'Fixture witness', 'Fixture language', 'A fixture witness used only by the automated tests.', 'Fixture limitation: no surviving witness can be certified as an original revelation.') returning id`,
    [slug],
  );
  await review("scripture_witness", w!.id);
  await db.as(scientist, "insert into public.scripture_historical_reviews (witness_id, reviewer_id, decision) values ($1, $2, 'approved')", [w!.id, scientist]);
  await db.as(editor, "update public.scripture_witnesses set status = 'published' where id = $1", [w!.id]);
  return w!.id;
}

describe("the seeded witness registry", () => {
  test("ten reference rows across the three layers, all draft, each with a limitation", async () => {
    const rows = await db.admin<{ layer: string; status: string; limitation: string; dating_note: string | null; slug: string }>(
      "select layer, status, limitation, dating_note, slug from public.scripture_witnesses where sort_order > 0 order by sort_order",
    );
    const seeded = rows;
    expect(seeded).toHaveLength(10);
    expect(seeded.map((r) => r.layer).reduce((a, l) => ({ ...a, [l]: (a[l as "tawrah"] ?? 0) + 1 }), {} as Record<string, number>)).toEqual({ tawrah: 4, zabur: 3, injil: 3 });
    expect(seeded.every((r) => r.status === "draft")).toBe(true);
    expect(seeded.every((r) => r.limitation.length >= 40)).toBe(true);
    // Unsure dates are left empty ("Not established" in the app), never guessed.
    expect(seeded.filter((r) => r.dating_note === null).map((r) => r.slug).sort()).toEqual(["samaritan-pentateuch", "septuagint-psalms"]);
  });

  test("the limitation texts say what the brief requires, and no row claims to be an original", async () => {
    const rows = await db.admin<{ layer: string; limitation: string; what_it_is: string }>("select layer, limitation, what_it_is from public.scripture_witnesses where sort_order > 0 and slug !~ '^fx'");
    for (const r of rows.filter((x) => x.layer === "tawrah")) expect(r.limitation).toMatch(/no surviving witness can be certified as Musa's original revelation/);
    for (const r of rows.filter((x) => x.layer === "zabur")) expect(r.limitation).toMatch(/cannot simply be equated in its entirety with the original Zabur given to Dawud/);
    for (const r of rows.filter((x) => x.layer === "injil")) expect(r.limitation).toMatch(/not manuscripts demonstrably identical to the Injil revealed to Isa/);
    for (const r of rows) expect(`${r.what_it_is} ${r.limitation}`).not.toMatch(/\b(is|are) the original (Tawrah|Torah|Zabur|Injil)/i);
  });

  test("no scripture text is stored: no text-bearing column, and no Hebrew, Greek or Arabic script in the descriptions", async () => {
    const cols = await db.admin<{ column_name: string }>("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'scripture_witnesses'");
    expect(cols.map((c) => c.column_name).filter((c) => /^(text|body|content|verse|passage|quote|arabic|hebrew|greek)/.test(c))).toEqual([]);
    const rows = await db.admin<{ t: string }>("select concat_ws(' ', name_en, language, dating_note, what_it_is, limitation) as t from public.scripture_witnesses");
    for (const r of rows) expect(r.t).not.toMatch(/[֐-׿Ͱ-Ͽἀ-῿؀-ۿ]/);
    await rejects(
      db.as(editor, "insert into public.scripture_witnesses (slug, layer, kind, name_en, language, what_it_is, limitation) values ('fx-script', 'injil', 'codex', 'Fixture', 'Greek', $1, 'A limitation text that is long enough to pass the length check.') returning id", ["A description with Greek letters αβγδ inside it."]),
      /check constraint/,
    );
  });

  test("nothing is public: anon sees no draft witness", async () => {
    expect(await db.as(null, "select slug from public.scripture_witnesses")).toEqual([]);
    expect(await db.as(alice, "select slug from public.scripture_witnesses")).toEqual([]);
    expect((await db.as(editor, "select slug from public.scripture_witnesses")).length).toBeGreaterThanOrEqual(10);
  });
});

describe("witness rules", () => {
  test("the limitation is mandatory and substantial; the layer and kind are closed lists", async () => {
    const base = (limitation: string | null, layer = "tawrah", kind = "codex") =>
      db.as(editor, "insert into public.scripture_witnesses (slug, layer, kind, name_en, language, what_it_is, limitation) values ($1, $2, $3, 'Fixture', 'Greek', 'A fixture description long enough to pass.', $4)", [`fx-${++n}`, layer, kind, limitation]);
    await rejects(base(null), /null value|not-null/);
    await rejects(base("short"), /check constraint/);
    await rejects(base("x".repeat(39)), /check constraint/);
    await rejects(base("x".repeat(60), "qur_an"), /check constraint/);
    await rejects(base("x".repeat(60), "tawrah", "scroll"), /check constraint/);
    await base("A limitation that says what this fixture witness cannot show.");
  });

  test("publishing needs the scholarly review AND the historical review; nobody reviews their own entry", async () => {
    const [w] = await db.as<{ id: string }>(
      editorReviewer,
      "insert into public.scripture_witnesses (slug, layer, kind, name_en, language, what_it_is, limitation) values ('fx-pub', 'zabur', 'codex', 'Fixture', 'Greek', 'A fixture description long enough to pass.', 'The surviving Book of Psalms is a collection; a fixture limitation.') returning id",
    );
    await rejects(db.as(editorReviewer, "update public.scripture_witnesses set status = 'published' where id = $1", [w!.id]), /no review, no publish/);
    await rejects(review("scripture_witness", w!.id, editorReviewer), /cannot review their own/);
    await review("scripture_witness", w!.id, reviewer);
    await rejects(db.as(editorReviewer, "update public.scripture_witnesses set status = 'published' where id = $1", [w!.id]), /historical review/);
    // Only a historical/scientific reviewer signs the historical review, and not for their own entry.
    await rejects(db.as(reviewer, "insert into public.scripture_historical_reviews (witness_id, reviewer_id, decision) values ($1, $2, 'approved')", [w!.id, reviewer]), /row-level security|historical\/scientific reviewer/);
    await rejects(db.as(editor, "insert into public.scripture_historical_reviews (witness_id, reviewer_id, decision) values ($1, $2, 'approved')", [w!.id, editor]), /row-level security|historical\/scientific reviewer/);
    await db.as(scientist, "insert into public.scripture_historical_reviews (witness_id, reviewer_id, decision) values ($1, $2, 'approved')", [w!.id, scientist]);
    await db.as(editorReviewer, "update public.scripture_witnesses set status = 'published' where id = $1", [w!.id]);
    expect((await db.as<{ slug: string }>(null, "select slug from public.scripture_witnesses where slug = 'fx-pub'"))).toHaveLength(1);
  });

  test("a published witness is fixed (limitation included) until it is moved to correction", async () => {
    witnessId = await publishedWitness("fx-frozen");
    await rejects(db.as(editor, "update public.scripture_witnesses set limitation = 'A different limitation that is long enough to pass the check.' where id = $1", [witnessId]), /is fixed/);
    await rejects(db.as(editor, "update public.scripture_witnesses set dating_note = 'Invented date' where id = $1", [witnessId]), /is fixed/);
    await db.as(editor, "update public.scripture_witnesses set status = 'correction' where id = $1", [witnessId]);
    await db.as(editor, "update public.scripture_witnesses set dating_note = 'A corrected broad range' where id = $1", [witnessId]);
    // Back to published for the citation tests (the earlier approvals stand).
    await db.as(editor, "update public.scripture_witnesses set status = 'published' where id = $1", [witnessId]);
  });

  test("the author column is stamped, and RLS lets only editors write", async () => {
    const [w] = await db.as<{ created_by: string }>(editor, "insert into public.scripture_witnesses (slug, layer, kind, name_en, language, what_it_is, limitation, created_by) values ('fx-stamp', 'injil', 'papyri', 'Fixture', 'Greek', 'A fixture description long enough to pass.', 'A fixture limitation long enough to pass the length check.', $1) returning created_by", [alice]);
    expect(w!.created_by).toBe(editor);
    await rejects(db.as(alice, "insert into public.scripture_witnesses (slug, layer, kind, name_en, language, what_it_is, limitation) values ('fx-alice', 'injil', 'papyri', 'Fixture', 'Greek', 'A fixture description long enough to pass.', 'A fixture limitation long enough to pass the length check.')"), /row-level security/);
    await rejects(db.as(null, "insert into public.scripture_witnesses (slug, layer, kind, name_en, language, what_it_is, limitation) values ('fx-anon', 'injil', 'papyri', 'Fixture', 'Greek', 'A fixture description long enough to pass.', 'A fixture limitation long enough to pass the length check.')"), /permission denied/);
  });
});

describe("citing a witness", () => {
  test("a scripture citation names the witness and an exact locator (with a number), and nothing else", async () => {
    const c = await claim("scholar", [], false);
    await rejects(db.as(editor, "insert into public.claim_references (claim_id, kind, locator) values ($1, 'scripture', 'Fixture 5:3')", [c]), /check constraint/);
    await rejects(db.as(editor, "insert into public.claim_references (claim_id, kind, scripture_witness_id) values ($1, 'scripture', $2)", [c, witnessId]), /check constraint/);
    await rejects(db.as(editor, "insert into public.claim_references (claim_id, kind, scripture_witness_id, locator) values ($1, 'scripture', $2, 'the book of fixtures')", [c, witnessId]), /check constraint/);
    await rejects(db.as(editor, "insert into public.claim_references (claim_id, kind, scripture_witness_id, locator, source_id) values ($1, 'tafsir', $2, 'p. 1', $3)", [c, witnessId, sourceId]), /check constraint/);
    await addRef(c, "scripture");
  });

  test("a claim that cites a draft witness cannot be approved; a published witness is fine", async () => {
    const [d] = await db.as<{ id: string }>(editor, "insert into public.scripture_witnesses (slug, layer, kind, name_en, language, what_it_is, limitation) values ('fx-draftw', 'injil', 'codex', 'Fixture', 'Greek', 'A fixture description long enough to pass.', 'A fixture limitation long enough to pass the length check.') returning id");
    const [c] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence) values ('Fixture claim citing a draft witness', 'scholar') returning id");
    await addRef(c!.id, "scripture", d!.id);
    await review("claim", c!.id);
    await rejects(db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [c!.id]), /only published witnesses/);
    const ok = await claim("scholar", ["scripture"]);
    expect(ok).toBeTruthy();
  });
});

describe("the evidence class is derived, and the database and TypeScript agree", () => {
  const cases: Array<{ evidence: EvidenceKind; refs: Ref[]; confidence?: EvidenceKind }> = [
    { evidence: "quran", refs: ["quran"] },
    { evidence: "quran", refs: ["scholar"] }, // a Quran label without a verse is not green
    { evidence: "quran", refs: ["quran", "scripture"] },
    { evidence: "hadith", refs: ["hadith"] },
    { evidence: "hadith", refs: ["tafsir"] },
    { evidence: "scholar", refs: ["tafsir"] },
    { evidence: "scholar", refs: ["scholar", "scripture"] },
    { evidence: "scholar", refs: ["scripture"] },
    { evidence: "scholar", refs: ["history"] },
    { evidence: "scholar", refs: ["quran"] },
    { evidence: "estimate", refs: ["history"] },
    { evidence: "estimate", refs: ["scripture"] },
    { evidence: "estimate", refs: ["scholar"] },
    { evidence: "estimate", refs: ["history", "scripture"] },
    { evidence: "disputed", refs: ["quran"] },
    { evidence: "unknown", refs: ["tafsir"] },
    { evidence: "quran", refs: ["quran"], confidence: "disputed" },
    { evidence: "scholar", refs: ["tafsir"], confidence: "unknown" },
  ];
  test.each(cases.map((c, i) => [i, c] as const))("case %i", async (_i, c) => {
    const id = await claim(c.evidence, c.refs, false);
    const [row] = await db.admin<{ cls: string; kinds: string[] }>(
      "select public.lineage_evidence_class($2::public.evidence_kind, $1) as cls, array(select kind from public.claim_references where claim_id = $1) as kinds",
      [id, c.confidence ?? c.evidence],
    );
    const ts = deriveEvidenceClass({ confidence: (c.confidence ?? c.evidence) as EvidenceKind, claimEvidence: c.evidence, referenceKinds: row!.kinds });
    expect(row!.cls).toBe(ts);
    expect(LINEAGE_CLASSES).toContain(row!.cls);
  });

  test("a missing claim is unknown, and the view carries the derived class", async () => {
    const [r] = await db.admin<{ c: string }>("select public.lineage_evidence_class('quran', gen_random_uuid()) as c");
    expect(r!.c).toBe("unknown");
    const a = await person("fx-v-a");
    const b = await person("fx-v-b");
    const c = await claim("scholar", ["scripture"]);
    await db.as(editor, "insert into public.relationships (person_from, person_to, kind, claim_id, confidence) values ($1, $2, 'parent_of', $3, 'scholar')", [a, b, c]);
    const [v] = await db.admin<{ evidence_class: string; reference_classes: string[] }>("select evidence_class, reference_classes from public.relationship_evidence where person_from = $1", [a]);
    expect(v).toEqual({ evidence_class: "scripture", reference_classes: ["scripture"] });
  });
});

describe("gap nodes", () => {
  test("a gap needs a claim and a note, names two different people, and cannot be published without evidence and review", async () => {
    const a = await person("fx-g-a");
    const b = await person("fx-g-b");
    const note = "Traditional genealogies differ; exact chain not authenticated.";
    const base = "insert into public.lineage_gaps (person_from, person_to, claim_id, confidence, note) values ($1, $2, $3, 'disputed', $4) returning id";
    await rejects(db.as(editor, base, [a, b, null, note]), /null value|not-null/);
    await rejects(db.as(editor, base, [a, b, await claim("disputed", ["tafsir"]), null]), /null value|not-null/);
    await rejects(db.as(editor, base, [a, b, await claim("disputed", ["tafsir"]), "short"]), /check constraint/);
    await rejects(db.as(editor, base, [a, a, await claim("disputed", ["tafsir"]), note]), /check constraint/);

    const unapproved = await claim("disputed", ["tafsir"], false);
    const [g] = await db.as<{ id: string }>(editor, base, [a, b, unapproved, note]);
    await review("lineage_gap", g!.id);
    await rejects(db.as(editor, "update public.lineage_gaps set status = 'published' where id = $1", [g!.id]), /unapproved claim/);

    const [g2] = await db.as<{ id: string }>(editor, base, [a, b, await claim("disputed", ["tafsir"]), note]);
    await rejects(db.as(editor, "update public.lineage_gaps set status = 'published' where id = $1", [g2!.id]), /no review, no publish/);
    await review("lineage_gap", g2!.id);
    await db.as(editor, "update public.lineage_gaps set status = 'published' where id = $1", [g2!.id]);
    // Fixed once published, and counted publicly without a title.
    await rejects(db.as(editor, "update public.lineage_gaps set note = 'Changed after publication, which must not be allowed.' where id = $1", [g2!.id]), /is fixed/);
    expect((await db.as<{ id: string }>(null, "select id from public.lineage_gaps")).map((r) => r.id)).toEqual([g2!.id]);
  });

  test("a gap between unpublished people cannot be published; a claim without references cannot carry it", async () => {
    const a = await person("fx-g-c");
    const b = await person("fx-g-d", false);
    const [g] = await db.as<{ id: string }>(editor, "insert into public.lineage_gaps (person_from, person_to, claim_id, confidence, note) values ($1, $2, $3, 'disputed', 'Traditional genealogies differ; exact chain not authenticated.') returning id", [a, b, await claim("disputed", ["tafsir"])]);
    await review("lineage_gap", g!.id);
    await rejects(db.as(editor, "update public.lineage_gaps set status = 'published' where id = $1", [g!.id]), /unpublished person/);
    // A claim cannot even be approved without a reference.
    const [bare] = await db.as<{ id: string }>(editor, "insert into public.evidence_claims (statement, evidence) values ('Fixture claim with no references', 'scholar') returning id");
    await review("claim", bare!.id);
    await rejects(db.as(editor, "update public.evidence_claims set status = 'approved' where id = $1", [bare!.id]), /no evidence, no publish/);
  });

  test("an editor who is also a reviewer cannot approve their own gap or node claim", async () => {
    const a = await person("fx-g-e");
    const b = await person("fx-g-f");
    const [g] = await db.as<{ id: string }>(editorReviewer, "insert into public.lineage_gaps (person_from, person_to, claim_id, confidence, note) values ($1, $2, $3, 'disputed', 'Traditional genealogies differ; exact chain not authenticated.') returning id", [a, b, await claim("disputed", ["tafsir"])]);
    await rejects(review("lineage_gap", g!.id, editorReviewer), /cannot review their own/);
    const [nc] = await db.as<{ id: string }>(editorReviewer, "insert into public.lineage_node_claims (person_id, aspect, claim_id, confidence) values ($1, 'name', $2, 'scholar') returning id", [a, await claim("scholar", ["tafsir"])]);
    await rejects(review("lineage_node_claim", nc!.id, editorReviewer), /cannot review their own/);
  });

  test("competing gaps share a group only when disputed", async () => {
    const a = await person("fx-g-g");
    const b = await person("fx-g-h");
    const grp = "11111111-1111-1111-1111-111111111111";
    await rejects(db.as(editor, "insert into public.lineage_gaps (person_from, person_to, claim_id, confidence, note, competing_group) values ($1, $2, $3, 'scholar', 'A note that is long enough to pass.', $4)", [a, b, await claim("scholar", ["tafsir"]), grp]), /check constraint/);
    await db.as(editor, "insert into public.lineage_gaps (person_from, person_to, claim_id, confidence, note, competing_group) values ($1, $2, $3, 'disputed', 'A note that is long enough to pass.', $4)", [a, b, await claim("disputed", ["tafsir"]), grp]);
  });
});

describe("node claims", () => {
  test("a node claim is cited, reviewed, restricted to known aspects, and fixed once published", async () => {
    const p = await person("fx-n-a");
    await rejects(db.as(editor, "insert into public.lineage_node_claims (person_id, aspect, claim_id, confidence) values ($1, 'wealth', $2, 'scholar')", [p, await claim("scholar", ["tafsir"])]), /check constraint/);
    const cl = await claim("scholar", ["tafsir"]);
    const [nc] = await db.as<{ id: string }>(editor, "insert into public.lineage_node_claims (person_id, aspect, claim_id, confidence, note) values ($1, 'lifespan', $2, 'scholar', 'Stated by the source; not independently dated.') returning id", [p, cl]);
    await rejects(db.as(editor, "update public.lineage_node_claims set status = 'published' where id = $1", [nc!.id]), /no review, no publish/);
    await review("lineage_node_claim", nc!.id);
    await db.as(editor, "update public.lineage_node_claims set status = 'published' where id = $1", [nc!.id]);
    await rejects(db.as(editor, "update public.lineage_node_claims set aspect = 'dates' where id = $1", [nc!.id]), /is fixed/);
  });
});

describe("links, the lineage graph and the public counts", () => {
  test("the unpublished relationship is invisible; publishing it freezes it; the graph carries class, tradition and uncertainty", async () => {
    const a = await person("fx-l-a");
    const b = await person("fx-l-b");
    const c = await claim("scholar", ["scripture"]);
    const [r] = await db.as<{ id: string }>(editor, "insert into public.relationships (person_from, person_to, kind, claim_id, confidence, tradition, uncertainty_note) values ($1, $2, 'parent_of', $3, 'scholar', 'Fixture tradition', 'What is uncertain, in a sentence.') returning id", [a, b, c]);
    const before = (await db.as<{ g: { links: Array<{ id: string }> } }>(null, "select public.lineage_graph() g"))[0]!.g;
    expect(before.links.find((l) => l.id === r!.id)).toBeUndefined();
    await review("relationship", r!.id);
    await db.as(editor, "update public.relationships set status = 'published' where id = $1", [r!.id]);
    const g = (await db.as<{ g: { links: Array<Record<string, unknown>>; people: unknown[] } }>(null, "select public.lineage_graph() g"))[0]!.g;
    const l = g.links.find((x) => x.id === r!.id)!;
    expect(l).toMatchObject({ ancestor: "fx-l-a", descendant: "fx-l-b", evidenceClass: "scripture", referenceClasses: ["scripture"], tradition: "Fixture tradition", uncertainty: "What is uncertain, in a sentence." });
    await rejects(db.as(editor, "update public.relationships set uncertainty_note = 'Changed later and silently.' where id = $1", [r!.id]), /is fixed/);
    // A descendant_of edge is normalised to ancestor -> descendant.
    const c2 = await claim("scholar", ["tafsir"]);
    const [r2] = await db.as<{ id: string }>(editor, "insert into public.relationships (person_from, person_to, kind, claim_id, confidence) values ($2, $1, 'descendant_of', $3, 'scholar') returning id", [a, b, c2]);
    await review("relationship", r2!.id);
    await db.as(editor, "update public.relationships set status = 'published' where id = $1", [r2!.id]);
    const g2 = (await db.as<{ g: { links: Array<{ id: string; ancestor: string; descendant: string }> } }>(null, "select public.lineage_graph() g"))[0]!.g;
    expect(g2.links.find((x) => x.id === r2!.id)).toMatchObject({ ancestor: "fx-l-a", descendant: "fx-l-b" });
  });

  test("the counts table follows the data and exposes numbers only", async () => {
    const stats = await db.as<{ item: string; published: number; under_review: number }>(null, "select item, published, under_review from public.lineage_stats order by item");
    expect(stats.map((s) => s.item)).toEqual(["gaps", "links", "node_claims", "witnesses"]);
    const [w] = await db.admin<{ p: number; u: number }>("select count(*) filter (where status = 'published')::int as p, count(*) filter (where status in ('draft','in_review','approved','correction'))::int as u from public.scripture_witnesses");
    const sw = stats.find((s) => s.item === "witnesses")!;
    expect(sw.published).toBe(w!.p);
    expect(sw.under_review).toBe(w!.u);
    expect(await db.as(editor, "select 1 from information_schema.columns where table_name = 'lineage_stats' and column_name not in ('item','published','under_review')")).toEqual([]);
    await rejects(db.as(editor, "update public.lineage_stats set published = 99"), /permission denied/);
  });

  test("the review types are registered for the no-self-review rule", async () => {
    const t = await db.admin<{ type: string }>("select type from public.review_entity_types where module = 'lineage' order by 1");
    expect(t.map((r) => r.type)).toEqual(["lineage_gap", "lineage_node_claim", "scripture_witness"]);
    const a = await db.admin<{ entity_type: string }>("select entity_type from public.review_entity_authors where table_name in ('lineage_gaps','lineage_node_claims','scripture_witnesses') order by 1");
    expect(a).toHaveLength(3);
    void admin;
  });
});
