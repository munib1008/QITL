import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, notConfigured, parseQuery, publicJson } from "@/lib/api";
import { getServerSupabase } from "@/lib/supabase/server";

const Query = z.object({ depth: z.coerce.number().int().min(1).max(4).default(2) });

/** The family graph around a person: published edges only, each with the claim and evidence behind it. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().regex(/^[a-z0-9-]{1,120}$/).safeParse(id).success) return fail(404, "not_found", "Not found.");
  const q = parseQuery(req, Query);
  if (isResponse(q)) return q;
  const sb = await getServerSupabase();
  if (!sb) return notConfigured();
  const { data, error } = await sb.rpc("person_graph", { person_slug: id, depth: q.depth });
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "No published person with that address.");
  return publicJson(data);
}
