import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import { e2eFixturesEnabled } from "@/lib/e2e-fixtures";
import { EMPTY_COUNTS, EMPTY_DOC, type LineageCounts, type LineageDoc, type ScriptureWitness } from "@/lib/lineage/types";
import { FIXTURE_COUNTS, FIXTURE_EMPTY_COUNTS, fixtureLineage, fixtureWitnesses } from "@/lib/lineage/fixtures";

/**
 * Reads for the lineage view and /scriptures. Only the anonymous client is used, so row-level security returns published
 * rows only. `source` says where the data came from: "db", "fixture" (automated tests, banner shown) or "none" (the
 * database is not connected).
 */
export interface LineageData {
  doc: LineageDoc;
  counts: LineageCounts;
  source: "db" | "fixture" | "none";
}

async function loadCounts(): Promise<LineageCounts | null> {
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("lineage_stats").select("item, published, under_review");
  if (error || !data) return null;
  const out: LineageCounts = JSON.parse(JSON.stringify(EMPTY_COUNTS));
  const key: Record<string, keyof LineageCounts> = { links: "links", gaps: "gaps", node_claims: "nodeClaims", witnesses: "witnesses" };
  for (const r of data as Array<{ item: string; published: number; under_review: number }>) {
    const k = key[r.item];
    if (k) out[k] = { published: Number(r.published), underReview: Number(r.under_review) };
  }
  return out;
}

export async function loadLineage(opts: { empty?: boolean } = {}): Promise<LineageData> {
  if (e2eFixturesEnabled()) {
    return opts.empty ? { doc: EMPTY_DOC, counts: FIXTURE_EMPTY_COUNTS, source: "fixture" } : { doc: fixtureLineage(), counts: FIXTURE_COUNTS, source: "fixture" };
  }
  const sb = getPublicSupabase();
  if (!sb) return { doc: EMPTY_DOC, counts: EMPTY_COUNTS, source: "none" };
  const [g, counts] = await Promise.all([sb.rpc("lineage_graph"), loadCounts()]);
  const doc: LineageDoc = g.error || !g.data ? EMPTY_DOC : { ...EMPTY_DOC, ...(g.data as Partial<LineageDoc>) };
  return { doc, counts: counts ?? EMPTY_COUNTS, source: "db" };
}

export interface WitnessData {
  witnesses: ScriptureWitness[];
  counts: LineageCounts["witnesses"];
  source: "db" | "fixture" | "none";
}

export async function loadWitnesses(opts: { empty?: boolean } = {}): Promise<WitnessData> {
  if (e2eFixturesEnabled()) {
    return opts.empty
      ? { witnesses: [], counts: FIXTURE_EMPTY_COUNTS.witnesses, source: "fixture" }
      : { witnesses: fixtureWitnesses(), counts: FIXTURE_COUNTS.witnesses, source: "fixture" };
  }
  const sb = getPublicSupabase();
  if (!sb) return { witnesses: [], counts: EMPTY_COUNTS.witnesses, source: "none" };
  const [w, counts] = await Promise.all([
    sb
      .from("scripture_witnesses")
      .select("id, slug, layer, kind, name_en, name_ar, name_ur, language, dating_note, what_it_is, limitation")
      .eq("status", "published")
      .order("sort_order"),
    loadCounts(),
  ]);
  const rows = (w.error || !w.data ? [] : w.data) as Array<Record<string, string | null>>;
  return {
    witnesses: rows.map((r) => ({
      id: r.id!,
      slug: r.slug!,
      layer: r.layer as ScriptureWitness["layer"],
      kind: r.kind as ScriptureWitness["kind"],
      name: r.name_en!,
      nameAr: r.name_ar ?? null,
      nameUr: r.name_ur ?? null,
      language: r.language!,
      dating: r.dating_note ?? null,
      whatItIs: r.what_it_is!,
      limitation: r.limitation!,
    })),
    counts: counts?.witnesses ?? EMPTY_COUNTS.witnesses,
    source: "db",
  };
}
