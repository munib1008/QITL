import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import { aliasExpansions, dedupe, FACETS, isFacet, isKind, plainSnippet, scoreFields, SEARCH_KINDS, searchJourney, type Facet, type SearchHit, type SearchKind } from "@/lib/search";
import { isTrack, TRACK_IDS, type TrackId } from "@/lib/events/tracks";
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
  /** The typed filters (kind of result, timeline track, surah), echoed from the request. */
  kind: SearchKind | null;
  track: TrackId | null;
  surah: number | null;
  /** Count per facet over all results (before the facet filter). */
  facets: Partial<Record<Facet, number>>;
  /** Counts per result type, track and surah; each ignores its own filter so a visitor can switch between values. */
  kinds: Partial<Record<SearchKind, number>>;
  tracks: Partial<Record<TrackId, number>>;
  surahs: Array<{ surah: number; count: number }>;
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
  kind?: string | null;
  track?: string | null;
  surahs?: number[] | null;
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
      ...(isKind(r.kind) ? { kind: r.kind } : {}),
      ...(r.track && isTrack(r.track) ? { track: r.track } : {}),
      surahs: (r.surahs ?? []).map(Number),
    });
  }
  return { state: "ok", hits };
}

export interface SearchInput {
  q: string;
  facet?: string | null;
  page?: number;
  locale?: string;
  kind?: string | null;
  track?: string | null;
  surah?: number | null;
}

type Skip = "facet" | "kind" | "track" | "surah" | null;

export async function unifiedSearch(input: SearchInput): Promise<SearchResult> {
  const q = input.q.trim().slice(0, MAX_QUERY);
  const facet = input.facet && isFacet(input.facet) ? input.facet : null;
  const kind = isKind(input.kind) ? input.kind : null;
  const track = input.track && isTrack(input.track) ? input.track : null;
  const surah = input.surah && Number.isInteger(input.surah) && input.surah >= 1 && input.surah <= 114 ? input.surah : null;
  const empty: SearchResult = { q, page: 1, pages: 0, total: 0, perPage: PER_PAGE, facet, kind, track, surah, facets: {}, kinds: {}, tracks: {}, surahs: [], database: "not_configured", results: [] };
  if (!q) return empty;
  const db = await searchDatabase(q);
  const all = dedupe([...searchJourney(q), ...searchSurahs(q), ...searchQuran(q), ...searchStatic(q, input.locale ?? "en"), ...db.hits]);
  // Faceted counts: every facet is counted over the results that pass the OTHER filters.
  const keep = (h: SearchHit, skip: Skip) =>
    (skip === "facet" || !facet || h.facet === facet) &&
    (skip === "kind" || !kind || h.kind === kind) &&
    (skip === "track" || !track || h.track === track) &&
    (skip === "surah" || !surah || !!h.surahs?.includes(surah));
  const facets: Partial<Record<Facet, number>> = {};
  for (const h of all) if (keep(h, "facet")) facets[h.facet] = (facets[h.facet] ?? 0) + 1;
  const kinds: Partial<Record<SearchKind, number>> = {};
  for (const h of all) if (h.kind && keep(h, "kind")) kinds[h.kind] = (kinds[h.kind] ?? 0) + 1;
  const tracks: Partial<Record<TrackId, number>> = {};
  for (const h of all) if (h.track && isTrack(h.track) && keep(h, "track")) tracks[h.track] = (tracks[h.track] ?? 0) + 1;
  const bySurah = new Map<number, number>();
  for (const h of all) if (keep(h, "surah")) for (const n of new Set(h.surahs ?? [])) bySurah.set(n, (bySurah.get(n) ?? 0) + 1);
  const filtered = all.filter((h) => keep(h, null));
  const pages = Math.ceil(filtered.length / PER_PAGE);
  const page = Math.min(Math.max(1, Math.floor(input.page ?? 1)), Math.max(1, pages));
  return {
    q,
    page,
    pages,
    total: filtered.length,
    perPage: PER_PAGE,
    facet,
    kind,
    track,
    surah,
    facets: Object.fromEntries(FACETS.filter((f) => facets[f]).map((f) => [f, facets[f]])) as Partial<Record<Facet, number>>,
    kinds: Object.fromEntries(SEARCH_KINDS.filter((k) => kinds[k]).map((k) => [k, kinds[k]])) as Partial<Record<SearchKind, number>>,
    tracks: Object.fromEntries(TRACK_IDS.filter((t) => tracks[t]).map((t) => [t, tracks[t]])) as Partial<Record<TrackId, number>>,
    surahs: [...bySurah].map(([n, count]) => ({ surah: n, count })).sort((a, b) => a.surah - b.surah),
    database: db.state,
    results: filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
  };
}
