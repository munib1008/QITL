import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import { aliasExpansions, dedupe, FACETS, isFacet, plainSnippet, scoreFields, searchJourney, type Facet, type SearchHit } from "@/lib/search";
import { searchQuran, searchStatic, searchSurahs } from "@/lib/search-sources";

/*
 * One search for the whole site, used by the /search page, the header field (a GET form to /search) and /api/search.
 * Sources: the journey (prophets, milestones), surah names, the imported Quran text, static pages, and the database
 * index of published content (public.search, migration 20261031002200). The database is queried with the anonymous,
 * cookie-free client: results are what any visitor may read, never a signed-in reader's own private rows, so they
 * can be cached publicly.
 */

export const PER_PAGE = 20;
export const MAX_QUERY = 120;

export type DbState = "ok" | "not_configured" | "error";

export interface SearchResult {
  q: string;
  page: number;
  pages: number;
  total: number;
  perPage: number;
  facet: Facet | null;
  /** Count per facet over all results (before the facet filter). */
  facets: Partial<Record<Facet, number>>;
  database: DbState;
  results: SearchHit[];
}

interface DbRow {
  entity_type: string;
  entity_id: string;
  url: string;
  title: string;
  title_ar: string | null;
  snippet: string | null;
  facet: string;
  rank: number;
}

/** Database hits, re-scored with the same matcher as the other sources so ranking is comparable. */
async function searchDatabase(q: string): Promise<{ state: DbState; hits: SearchHit[] }> {
  const sb = getPublicSupabase();
  if (!sb) return { state: "not_configured", hits: [] };
  const alts = aliasExpansions(q);
  const { data, error } = await sb.rpc("search", { q, facets: null, lim: 200, off: 0, alts: alts.length ? alts : null });
  if (error) return { state: "error", hits: [] };
  const hits: SearchHit[] = [];
  for (const r of (data ?? []) as DbRow[]) {
    if (!isFacet(r.facet) || !r.url.startsWith("/")) continue;
    const snippet = plainSnippet(r.snippet ?? "");
    const fields = [
      { text: r.title, title: true },
      { text: r.title_ar ?? "", title: true },
      { text: snippet },
    ];
    // Alias matches ("Joseph" finding a story titled Yusuf) score as the canonical name would.
    const direct = Math.max(scoreFields(q, fields), ...alts.map((a) => scoreFields(a, fields) * 0.95));
    hits.push({
      type: r.entity_type,
      id: r.entity_id,
      url: r.url,
      title: r.title,
      titleAr: r.title_ar ?? undefined,
      snippet,
      facet: r.facet,
      score: direct > 0 ? direct : 0.5 + Math.min(Number(r.rank) || 0, 1) * 2,
    });
  }
  return { state: "ok", hits };
}

export async function unifiedSearch(input: { q: string; facet?: string | null; page?: number; locale?: string }): Promise<SearchResult> {
  const q = input.q.trim().slice(0, MAX_QUERY);
  const facet = input.facet && isFacet(input.facet) ? input.facet : null;
  const empty: SearchResult = { q, page: 1, pages: 0, total: 0, perPage: PER_PAGE, facet, facets: {}, database: "not_configured", results: [] };
  if (!q) return empty;
  const db = await searchDatabase(q);
  const all = dedupe([...searchJourney(q), ...searchSurahs(q), ...searchQuran(q), ...searchStatic(q, input.locale ?? "en"), ...db.hits]);
  const facets: Partial<Record<Facet, number>> = {};
  for (const h of all) facets[h.facet] = (facets[h.facet] ?? 0) + 1;
  const filtered = facet ? all.filter((h) => h.facet === facet) : all;
  const pages = Math.ceil(filtered.length / PER_PAGE);
  const page = Math.min(Math.max(1, Math.floor(input.page ?? 1)), Math.max(1, pages));
  return {
    q,
    page,
    pages,
    total: filtered.length,
    perPage: PER_PAGE,
    facet,
    facets: Object.fromEntries(FACETS.filter((f) => facets[f]).map((f) => [f, facets[f]])) as Partial<Record<Facet, number>>,
    database: db.state,
    results: filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
  };
}
