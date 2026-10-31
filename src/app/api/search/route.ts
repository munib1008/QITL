import type { NextRequest } from "next/server";
import { z } from "zod";
import { isResponse, parseQuery, publicJson } from "@/lib/api";
import { MAX_QUERY, unifiedSearch } from "@/lib/search-engine";

const Query = z.object({
  q: z.string().trim().min(1).max(MAX_QUERY),
  facet: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  locale: z.enum(["en", "ar", "ur"]).optional(),
});

/**
 * Unified search (src/lib/search-engine.ts): journey, surahs, Quran text, static pages and the published database
 * index. Arabic and Urdu queries are normalised (vowel marks, letter forms); names match by alias, spelling key and
 * small typos. Only published, public content is ever returned, so the response is publicly cacheable.
 */
export async function GET(req: NextRequest) {
  const q = parseQuery(req, Query);
  if (isResponse(q)) return q;
  const r = await unifiedSearch({ q: q.q, facet: q.facet, page: q.page, locale: q.locale });
  return publicJson(r, 60);
}
