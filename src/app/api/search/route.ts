import type { NextRequest } from "next/server";
import { z } from "zod";
import { isResponse, parseQuery, publicJson } from "@/lib/api";
import { getServerSupabase } from "@/lib/supabase/server";
import { searchJourney, type SearchHit } from "@/lib/search";

const Query = z.object({
  q: z.string().trim().min(1).max(120),
  facet: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).max(50).default(1),
});

/**
 * Faceted search across the journey content and the published database index.
 * Arabic queries are normalised (vowel marks, letter variants); transliterations match by trigram.
 */
export async function GET(req: NextRequest) {
  const q = parseQuery(req, Query);
  if (isResponse(q)) return q;
  const facets = q.facet ? q.facet.split(",").filter(Boolean) : null;
  let hits: SearchHit[] = searchJourney(q.q);
  let database: "ok" | "not_configured" | "error" = "not_configured";
  const sb = await getServerSupabase();
  if (sb) {
    const { data, error } = await sb.rpc("search", { q: q.q, facets: null, lim: 50, off: 0 });
    database = error ? "error" : "ok";
    if (data)
      hits = hits.concat(
        (data as Array<{ entity_type: string; entity_id: string; url: string; title: string; title_ar: string | null; snippet: string; facet: SearchHit["facet"]; rank: number }>).map((r) => ({
          type: r.entity_type,
          id: r.entity_id,
          url: r.url,
          title: r.title,
          titleAr: r.title_ar ?? undefined,
          snippet: r.snippet,
          facet: r.facet,
          score: r.rank * 3,
        })),
      );
  }
  const counts: Record<string, number> = {};
  for (const h of hits) counts[h.facet] = (counts[h.facet] ?? 0) + 1;
  const filtered = facets ? hits.filter((h) => facets.includes(h.facet)) : hits;
  const per = 20;
  return publicJson({ q: q.q, total: filtered.length, page: q.page, facets: counts, database, results: filtered.slice((q.page - 1) * per, q.page * per) }, 60);
}
