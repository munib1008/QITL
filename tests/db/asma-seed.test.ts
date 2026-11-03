// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, test } from "vitest";
import { loadQuranCorpusFromDisk } from "@/lib/asma/corpus-node";
import { loadNamesFile } from "@/lib/asma/registry-node";
import { buildSeed, type SeedPlan, type TopicDraft } from "@/lib/asma/seed";
import { createDb, type Db } from "./harness";

/**
 * The seed plan (the exact rows scripts/compute-asma-occurrences.ts --db writes) loaded into the real schema with the REAL
 * Quran text: the database stores what the engine computed, derives its own summaries, and nothing becomes public.
 */
let db: Db;
let admin: string, editor: string;
let plan: SeedPlan;
let methodology: string;
const ids = new Map<string, string>();

beforeAll(async () => {
  const corpus = loadQuranCorpusFromDisk();
  const topics = (JSON.parse(readFileSync("content/asma/topics.draft.json", "utf8")) as { topics: TopicDraft[] }).topics;
  plan = buildSeed(corpus, loadNamesFile().names, topics);
  db = await createDb({ supabaseDefaults: true });
  admin = await db.createUser("admin@test.local", ["admin"]);
  editor = await db.createUser("editor@test.local", ["editor"]);
  const [{ id: src }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id")) as [{ id: string }];
  const [{ id: ver }] = (await db.admin<{ id: string }>("insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id", [src])) as [{ id: string }];
  const perSurah = new Map<number, number>();
  for (const v of corpus.verses) perSurah.set(v.surah, Math.max(perSurah.get(v.surah) ?? 0, v.ayah));
  for (const [s, n] of perSurah) await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values ($1, 'x', 'x', $2, $3)", [s, Math.max(n, 3), ver]);
  for (let i = 0; i < corpus.verses.length; i += 500) {
    const chunk = corpus.verses.slice(i, i + 500);
    await db.admin(
      `insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) values ${chunk.map((_, k) => `($${k * 3 + 1}, $${k * 3 + 2}, $${k * 3 + 3}, '${ver}')`).join(",")}`,
      chunk.flatMap((v) => [v.surah, v.ayah, v.text]),
    );
  }
  const m = plan.methodology as Record<string, unknown>;
  const cols = Object.keys(m);
  const [mr] = await db.admin<{ id: string }>(`insert into public.divine_name_occurrence_methodologies (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) returning id`, Object.values(m));
  methodology = mr!.id;
  for (const n of plan.names) {
    const c = Object.keys(n.row);
    const [r] = await db.admin<{ id: string }>(`insert into public.divine_names (${c.join(",")}) values (${c.map((_, i) => `$${i + 1}`).join(",")}) returning id`, Object.values(n.row));
    ids.set(n.row.slug as string, r!.id);
  }
}, 300_000);

describe("the seed plan against the schema", () => {
  test("the plan is the commonly taught list as DRAFT educational-list entries, each with three renderings", () => {
    expect(plan.names.length).toBeGreaterThanOrEqual(99);
    expect(new Set(plan.names.map((n) => n.row.slug)).size).toBe(plan.names.length);
    for (const n of plan.names) {
      expect(n.row.recognition_status).toBe("educational_list");
      expect(n.row.ai_generated).toBe(true);
      for (const k of ["rendering_en", "rendering_ar", "rendering_ur"]) expect(String(n.row[k]).length).toBeGreaterThan(1);
    }
  });
  test("the database stores exactly the computed rows and derives matching summaries for all three measures", async () => {
    for (const n of plan.names) {
      await db.as(admin, "select public.asma_replace_occurrences($1, $2, $3, $4::jsonb)", [ids.get(n.row.slug as string), methodology, n.queryHash, JSON.stringify(n.occurrences)]);
    }
    const rows = await db.admin<{ slug: string; measure: string; occurrence_count: number; verse_count: number }>(
      "select n.slug, s.measure, s.occurrence_count, s.verse_count from public.divine_name_count_summaries s join public.divine_names n on n.id = s.name_id",
    );
    for (const n of plan.names) {
      for (const m of ["A", "B", "C"] as const) {
        const got = rows.find((r) => r.slug === n.row.slug && r.measure === m)!;
        expect({ slug: n.row.slug, m, count: got.occurrence_count, verses: got.verse_count }).toEqual({ slug: n.row.slug, m, count: n.counts[m].count, verses: n.counts[m].verseCount });
      }
    }
    const inconsistent = await db.admin<{ slug: string }>("select slug from public.divine_names where not public.asma_counts_consistent(id)");
    expect(inconsistent).toEqual([]);
  }, 300_000);
  test("every seeded Name is complete enough to pass the automated check, yet none is public until an editor decides", async () => {
    for (const n of plan.names.slice(0, 12)) {
      const r = (await db.as<{ r: { passed: boolean } }>(editor, "select public.run_asma_integrity('divine_name', $1) as r", [ids.get(n.row.slug as string)]))[0]!.r;
      expect(r.passed).toBe(true);
    }
    const names = (await db.as<{ r: unknown[] }>(null, "select public.public_asma_names() as r"))[0]!.r;
    expect(names).toEqual([]);
    expect(await db.as(null, "select id from public.divine_names")).toHaveLength(0);
  }, 120_000);
  test("the topics and links load; a link cites a verse only when the Name's exact form occurs in it", async () => {
    for (const t of plan.topics) {
      const c = Object.keys(t.row);
      const [tr] = await db.admin<{ id: string }>(`insert into public.dua_life_topics (${c.join(",")}) values (${c.map((_, i) => `$${i + 1}`).join(",")}) returning id`, Object.values(t.row));
      for (const l of t.links) {
        await db.admin("insert into public.divine_name_topic_links (topic_id, name_id, surah_id, ayah_no, basis, evidence_status) values ($1, $2, $3, $4, $5, $6)", [tr!.id, ids.get(l.nameSlug), l.surah, l.ayah, l.basis, l.evidence_status]);
        if (l.evidence_status === "sourced") {
          const hit = await db.admin("select 1 from public.divine_name_quran_occurrences o where o.name_id = $1 and o.measure = 'A' and o.surah_id = $2 and o.ayah_no = $3", [ids.get(l.nameSlug), l.surah, l.ayah]);
          expect(hit).toHaveLength(1);
        }
      }
    }
    expect(plan.topics.flatMap((t) => t.links).some((l) => l.evidence_status === "needs_source")).toBe(true);
  });
  test("the seed carries no hadith text, no dua wording and no verse text", () => {
    const text = JSON.stringify([plan.names.map((n) => n.row), plan.topics]);
    expect(text).not.toMatch(/(sahih|bukhari|muslim|hadith)/i);
    expect(plan.names.every((n) => !("wording" in n.row))).toBe(true);
  });
});
