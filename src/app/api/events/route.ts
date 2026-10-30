import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, notConfigured, parseQuery, publicJson } from "@/lib/api";
import { getServerSupabase } from "@/lib/supabase/server";

const Query = z.object({
  category: z.enum(["sacred_history", "prophetic_life", "islamic_history", "last_hour_minor", "last_hour_major"]).optional(),
  precision: z.enum(["exact", "range", "estimated", "relative", "unknown"]).optional(),
  // Astronomical years (1 BCE = 0). A year filter never returns undated events: they have no years.
  from: z.coerce.number().int().min(-10000).max(3000).optional(),
  to: z.coerce.number().int().min(-10000).max(3000).optional(),
});

/** Published events with people, places and date precision. Relative events come in text order. */
export async function GET(req: NextRequest) {
  const q = parseQuery(req, Query);
  if (isResponse(q)) return q;
  const sb = await getServerSupabase();
  if (!sb) return notConfigured();
  let query = sb
    .from("historical_events")
    .select(
      "id, slug, title, title_ar, summary, category, date_precision, relative_order, start_year, end_year, start_ah, end_ah, date_note, event_people(people(slug, name_en)), event_places(locations(id, slug, name_en)), evidence_claims(evidence)",
    )
    .eq("status", "published")
    .order("relative_order", { ascending: true, nullsFirst: false })
    .order("start_year", { ascending: true, nullsFirst: true })
    .limit(500);
  if (q.category) query = query.eq("category", q.category);
  if (q.precision) query = query.eq("date_precision", q.precision);
  if (q.from != null) query = query.gte("end_year", q.from);
  if (q.to != null) query = query.lte("start_year", q.to);
  const { data, error } = await query;
  if (error) return dbError(error);
  return publicJson({ events: data });
}
