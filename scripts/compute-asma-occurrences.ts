/**
 * Computes the Asma' al-Husna occurrence counts from the pinned Quran corpus (content/quran) and, with --db, writes the
 * draft registry and the computed occurrences.
 *
 *   pnpm tsx scripts/compute-asma-occurrences.ts            # dry run (default): prints the plan and the three separate measures per Name, writes nothing
 *   pnpm tsx scripts/compute-asma-occurrences.ts --verify   # also recomputes everything twice and checks byte-identical output
 *   pnpm tsx scripts/compute-asma-occurrences.ts --db       # needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment
 *
 * What --db writes (nothing is made public: every row is a private AI draft, scholarly_status not_reviewed):
 *   1. the counting methodology (policy versions + Quran edition checksums), as the current one. If one with the same version
 *      already exists with different checksums the run is refused: a new methodology needs a new version.
 *   2. the Names from content/asma/names.draft.json that are not stored yet (existing rows are never overwritten).
 *   3. for every Name, its occurrences through the database function asma_replace_occurrences (the only write path; the
 *      database derives the per-measure summaries from the rows it stored).
 *   4. the draft life-situation topics and their links.
 * Counts are never typed anywhere: this script only passes what the engine computed.
 */
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { buildIndex, countName, queryHash, serialiseCounts } from "../src/lib/asma/count";
import { loadQuranCorpusFromDisk } from "../src/lib/asma/corpus-node";
import { buildQuery } from "../src/lib/asma/registry";
import { loadNamesFile } from "../src/lib/asma/registry-node";
import { buildSeed, occurrenceRows, storedQuery, type InclusionRow, type TopicDraft } from "../src/lib/asma/seed";
import { parseFlags, requireEnv } from "../src/lib/importers/common";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const f = parseFlags(process.argv.slice(2));
  const corpus = loadQuranCorpusFromDisk(root);
  const index = buildIndex(corpus);
  const names = loadNamesFile(root).names;
  const topics = (JSON.parse(readFileSync(resolve(root, "content/asma/topics.draft.json"), "utf8")) as { topics: TopicDraft[] }).topics;
  const plan = buildSeed(corpus, names, topics, index);

  console.log(`Quran: ${corpus.edition.source} ${corpus.edition.version}, sha256 ${corpus.edition.sha256.slice(0, 12)}…, ${index.wordCount} words counted (${index.basmalaPrefixWords} basmala-prefix words skipped).`);
  console.log(`Methodology ${plan.methodology.version}: ${plan.methodology.normalisation_policy}, ${plan.methodology.tokenisation_policy}, ${plan.methodology.query_version}`);
  console.log("slug".padEnd(28), "A".padStart(5), "B".padStart(4), "C".padStart(4), "  (three separate measures; never added together)");
  for (const n of plan.names) console.log(String(n.row.slug).padEnd(28), String(n.counts.A.count).padStart(5), String(n.counts.B.count).padStart(4), String(n.counts.C.count).padStart(4));
  console.log(`${plan.names.length} Names, ${plan.topics.length} topics.`);

  if (f.has("verify")) {
    const again = buildIndex(loadQuranCorpusFromDisk(root));
    const bad = names.filter((n) => serialiseCounts(countName(again, buildQuery(n))) !== serialiseCounts(countName(index, buildQuery(n)))).map((n) => n.slug);
    if (bad.length) throw new Error(`not reproducible: ${bad.join(", ")}`);
    console.log("Reproducible: a second run from a freshly loaded corpus is byte-identical for every Name.");
  }

  if (!f.has("db")) {
    console.log("Dry run: nothing written. Pass --db to write to Supabase.");
    return;
  }
  const sb = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const m = plan.methodology as Record<string, string | boolean>;
  const existing = await sb.from("divine_name_occurrence_methodologies").select("id, edition_sha256, edition_content_sha256, query_version, normalisation_policy, tokenisation_policy").eq("version", m.version as string).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  let methodologyId: string;
  if (existing.data) {
    const d = existing.data as Record<string, string>;
    if (d.edition_sha256 !== m.edition_sha256 || d.edition_content_sha256 !== m.edition_content_sha256 || d.query_version !== m.query_version || d.normalisation_policy !== m.normalisation_policy || d.tokenisation_policy !== m.tokenisation_policy)
      throw new Error(`methodology ${m.version} exists with different checksums or policy versions: a changed methodology needs a new version (and sends every Name back for re-review)`);
    methodologyId = d.id as string;
  } else {
    const ins = await sb.from("divine_name_occurrence_methodologies").insert(plan.methodology).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    methodologyId = (ins.data as { id: string }).id;
  }
  const have = await sb.from("divine_names").select("slug, id");
  if (have.error) throw new Error(have.error.message);
  const ids = new Map((have.data ?? []).map((r) => [r.slug as string, r.id as string]));
  const fresh = plan.names.filter((n) => !ids.has(n.row.slug as string));
  if (fresh.length) {
    const ins = await sb.from("divine_names").insert(fresh.map((n) => n.row)).select("slug, id");
    if (ins.error) throw new Error(ins.error.message);
    for (const r of ins.data ?? []) ids.set(r.slug as string, r.id as string);
  }
  // A stored Name is recounted from ITS stored query (registered surface forms + published inclusion rows), never from the draft file.
  const stored = await sb.from("divine_names").select("id, slug, surface_forms");
  if (stored.error) throw new Error(stored.error.message);
  const incl = await sb.from("divine_name_inclusions").select("id, name_id, measure, form, root, basis").eq("status", "published");
  if (incl.error) throw new Error(incl.error.message);
  for (const n of plan.names) {
    const slug = n.row.slug as string;
    const id = ids.get(slug)!;
    const row = (stored.data ?? []).find((r) => r.id === id) as { surface_forms: string[] } | undefined;
    const mine = ((incl.data ?? []) as Array<InclusionRow & { name_id: string }>).filter((x) => x.name_id === id);
    const q = storedQuery(slug, row?.surface_forms ?? (n.row.surface_forms as string[]), mine);
    const counts = countName(index, q);
    const r = await sb.rpc("asma_replace_occurrences", { p_name: id, p_methodology: methodologyId, p_query_hash: queryHash(q), p_rows: occurrenceRows(counts) });
    if (r.error) throw new Error(`${slug}: ${r.error.message}`);
  }
  for (const t of plan.topics) {
    const got = await sb.from("dua_life_topics").select("id").eq("slug", t.row.slug as string).maybeSingle();
    let topicId = (got.data as { id: string } | null)?.id;
    if (!topicId) {
      const ins = await sb.from("dua_life_topics").insert(t.row).select("id").single();
      if (ins.error) throw new Error(ins.error.message);
      topicId = (ins.data as { id: string }).id;
    }
    for (const l of t.links) {
      const up = await sb.from("divine_name_topic_links").upsert({ topic_id: topicId, name_id: ids.get(l.nameSlug)!, surah_id: l.surah, ayah_no: l.ayah, basis: l.basis, evidence_status: l.evidence_status }, { onConflict: "topic_id,name_id", ignoreDuplicates: true });
      if (up.error) throw new Error(up.error.message);
    }
  }
  console.log(`Written: ${fresh.length} new Names, occurrences for ${plan.names.length} Names, ${plan.topics.length} topics. Everything is a private AI draft; nothing is public.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
