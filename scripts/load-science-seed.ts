/**
 * Loads the Quran & Science DRAFT inventory (content/science/topics.draft.json) as private AI drafts.
 *
 *   pnpm tsx scripts/load-science-seed.ts          # dry run (default): validates against the pinned Quran corpus, prints a summary, writes nothing
 *   pnpm tsx scripts/load-science-seed.ts --db     # needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment (owner action)
 *
 * Nothing becomes public: every topic is private_draft / not_reviewed. An editor runs the automated check and chooses
 * "Show as AI draft" in /admin/science. No rating is assigned and no publication is marked verified: only a science reviewer can do that.
 * An existing topic (same slug) is skipped, never overwritten.
 */
import { createClient } from "@supabase/supabase-js";
import { loadSeedFromDisk } from "../src/lib/science/seed-node";
import { writeSeed, type SeedSink } from "../src/lib/science/seed";

function requireEnv(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
}

async function main() {
  const topics = loadSeedFromDisk();
  const dated = topics.flatMap((t) => t.discoveries.flatMap((g) => g.milestones)).filter((m) => m.year != null).length;
  console.log(`${topics.length} topics validated against the Quran corpus; ${dated} dated milestones, each with its verified source.`);
  if (!process.argv.includes("--db")) {
    console.log("Dry run: nothing written. Pass --db to write to Supabase.");
    return;
  }
  const sb = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const existing = new Set(((await sb.from("science_topics").select("slug")).data ?? []).map((r: { slug: string }) => r.slug));
  const fresh = topics.filter((t) => !existing.has(t.slug));
  const sink: SeedSink = {
    async insert(table, row) {
      const { data, error } = await sb.from(table).insert(row).select("id").single();
      if (error) throw new Error(`${table}: ${error.message}`);
      return (data as { id: string }).id;
    },
  };
  await writeSeed(fresh, sink);
  console.log(`Wrote ${fresh.length} new private AI-draft topics (${topics.length - fresh.length} already present, left untouched).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
