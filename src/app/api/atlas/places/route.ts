import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, notConfigured, parseQuery, publicJson } from "@/lib/api";
import { getServerSupabase } from "@/lib/supabase/server";

const Query = z.object({
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .optional(),
  year: z.coerce.number().int().min(-10000).max(3000).optional(),
});

interface PlaceRow {
  id: string;
  location_slug: string;
  name: string;
  geom_precision: string;
  confidence: string;
  geojson: unknown;
  source: string | null;
  attribution: string | null;
}

/**
 * GeoJSON of published place geometries. Unknown places come back separately with no geometry,
 * so the client lists them beside the map instead of placing them.
 */
export async function GET(req: NextRequest) {
  const q = parseQuery(req, Query);
  if (isResponse(q)) return q;
  const sb = await getServerSupabase();
  if (!sb) return notConfigured();
  const { data, error } = await sb.rpc("atlas_places", { bbox: q.bbox ?? null, at_year: q.year ?? null });
  if (error) return dbError(error);
  const rows = (data ?? []) as PlaceRow[];
  return publicJson({
    type: "FeatureCollection",
    features: rows
      .filter((r) => r.geojson)
      .map((r) => ({
        type: "Feature",
        id: r.id,
        geometry: r.geojson,
        properties: { slug: r.location_slug, name: r.name, precision: r.geom_precision, confidence: r.confidence, source: r.source, attribution: r.attribution },
      })),
    unknown: rows.filter((r) => !r.geojson).map((r) => ({ slug: r.location_slug, name: r.name })),
  });
}
