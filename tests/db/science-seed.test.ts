// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { loadSeedFromDisk } from "@/lib/science/seed-node";
import { loadQuranCorpusFromDisk } from "@/lib/asma/corpus-node";
import { writeSeed, type SeedSink } from "@/lib/science/seed";
import { checkScienceText } from "@/lib/science/validator";
import { createDb, type Db } from "./harness";

/**
 * The draft inventory (content/science/topics.draft.json) loaded into the test database through the same writer the loader script
 * uses, with the real Quran corpus rows it refers to. Proves the inventory satisfies every database rule (Arabic terms are in the
 * verse text, years carry a source, nothing is rated, no publication is verified) and that nothing is public until an editor has
 * run the automated check and shown it as a labelled draft. Also compares the SQL text guard with the TypeScript validator.
 */
let db: Db;
let editor: string;

beforeAll(async () => {
  db = await createDb({ supabaseDefaults: true });
  editor = await db.createUser("editor@test.local", ["editor"]);
  const corpus = loadQuranCorpusFromDisk();
  const topics = loadSeedFromDisk();
  const [{ id: src }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Tanzil test import', 'cleared') returning id")) as [{ id: string }];
  const [{ id: ver }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [src],
  )) as [{ id: string }];
  const need = new Set(topics.flatMap((t) => t.links.map((l) => `${l.surah}:${l.ayah}`)));
  for (const s of new Set([...need].map((r) => Number(r.split(":")[0])))) await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values ($1, 'x', 'Fixture', 286, $2)", [s, ver]);
  for (const v of corpus.verses) if (need.has(`${v.surah}:${v.ayah}`)) await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values ($1, $2, $3, $4)", [v.surah, v.ayah, v.text, ver]);
  const sink: SeedSink = {
    async insert(table, row) {
      const cols = Object.keys(row);
      const [r] = await db.as<{ id: string }>(editor, `insert into public.${table} (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) returning id`, Object.values(row));
      return r!.id;
    },
  };
  await writeSeed(topics, sink);
}, 240_000);

describe("the draft inventory in the database", () => {
  test("13 private AI drafts, none rated, none reviewed, none public", async () => {
    const rows = await db.admin<Record<string, unknown>>("select slug, visibility, status, scholarly_status, scientific_review, ai_generated from public.science_topics order by created_at");
    expect(rows).toHaveLength(13);
    for (const r of rows) expect(r).toMatchObject({ visibility: "private_draft", status: "draft", scholarly_status: "not_reviewed", scientific_review: "not_reviewed", ai_generated: true });
    expect(await db.admin("select 1 from public.quran_science_links where interpretation_strength <> 'unassessed' or connection_strength <> 'unassessed'")).toHaveLength(0);
    expect(await db.admin("select 1 from public.science_claims where evidence_state not in ('unassessed', 'outside_empirical_science')")).toHaveLength(0);
    expect(await db.admin("select 1 from public.science_publications where verified")).toHaveLength(0);
    expect((await db.as<{ d: unknown[] }>(null, "select public.public_science_topics() as d"))[0]!.d).toEqual([]);
  });

  test("tafsir placeholders are needs_source with no wording", async () => {
    const rows = await db.admin<Record<string, unknown>>("select evidence_status, summary_en, scholar_name, source_id from public.quran_science_interpretations");
    expect(rows).toHaveLength(26);
    for (const r of rows) expect(r).toEqual({ evidence_status: "needs_source", summary_en: null, scholar_name: null, source_id: null });
  });

  test("every topic passes the automated check, and editors can show them as labelled drafts", async () => {
    const ids = await db.admin<{ id: string; slug: string }>("select id, slug from public.science_topics");
    for (const t of ids) {
      const [r] = await db.as<{ r: { passed: boolean; failures: string[] } }>(editor, "select public.run_science_integrity($1) as r", [t.id]);
      expect({ slug: t.slug, failures: r!.r.failures }).toEqual({ slug: t.slug, failures: [] });
      await db.as(editor, "select public.publish_science_ai_draft($1)", [t.id]);
    }
    const [d] = await db.as<{ d: Array<{ slug: string; scholarly_status: string; milestones: Array<{ year: number | null }> }> }>(null, "select public.public_science_topics() as d");
    expect(d!.d).toHaveLength(13);
    expect(d!.d.every((t) => t.scholarly_status === "not_reviewed")).toBe(true);
    const exp = d!.d.find((t) => t.slug === "sky-built-and-widened-51-47")!;
    expect(exp.milestones.filter((m) => m.year != null).map((m) => m.year)).toEqual([1922, 1929, 1931]);
    const [full] = await db.as<{ d: { publications: unknown[]; does_not_establish: { en: string } } }>(null, "select public.public_science_topic('sky-built-and-widened-51-47') as d");
    expect(full!.d.publications).toEqual([]); // unverified: not shown
    expect(full!.d.does_not_establish.en).toMatch(/does not by itself settle/);
  });

  test("the unseen topic is outside empirical science and not testable", async () => {
    const [r] = await db.admin<Record<string, unknown>>(
      "select c.evidence_state, l.relationship from public.science_topics t join public.science_claims c on c.topic_id = t.id join public.quran_science_links l on l.topic_id = t.id where t.slug = 'unseen-matters-2-3'",
    );
    expect(r).toEqual({ evidence_state: "outside_empirical_science", relationship: "not_scientifically_testable" });
  });
});

describe("the SQL text guard and the TypeScript validator agree on shared samples", () => {
  const samples = [
    "The proof score of this passage is high", "A scientific miracle proven by physics", "Science has proved the existence of the angels", "Modern research has confirmed that jinn exist",
    "Future research will confirm this verse", "Science will one day confirm the verse", "Still awaiting laboratory proof", "Honey cures every disease", "This gives guaranteed healing",
    "We are 95% confident in the reading", "Confidence score: 80", "هذه معجزة علمية مثبتة", "یہ سائنسی معجزہ ثابت ہے",
    "Observation supports expansion; the reading of the verse is debated.", "Fresh water and sea water meet in estuaries.", "The nature of the soul is not a subject of empirical science.",
    "This page makes no medical claim and gives no dose.", "Confidence in the measurement is discussed in the literature.", "Studies were carried out in 1929.",
  ];
  test("same verdict on every sample", async () => {
    for (const s of samples) {
      const [r] = await db.admin<{ ok: boolean }>("select public.science_text_ok($1) as ok", [s]);
      expect({ s, sql: r!.ok }).toEqual({ s, sql: checkScienceText(s).length === 0 });
    }
  });
});
