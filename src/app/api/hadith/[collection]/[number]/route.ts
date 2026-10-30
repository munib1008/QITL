import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, notConfigured, publicJson } from "@/lib/api";
import { getServerSupabase } from "@/lib/supabase/server";

const COLLECTIONS = ["bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "muwatta"] as const;
const P = z.object({ collection: z.enum(COLLECTIONS), number: z.string().regex(/^[0-9]+[a-z]?$/) });

/** One narration with every recorded grading (never collapsed) and licensed translations only. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ collection: string; number: string }> }) {
  const p = P.safeParse(await params);
  if (!p.success) return fail(404, "not_found", "Not found.");
  const sb = await getServerSupabase();
  if (!sb) return notConfigured();
  let query = sb
    .from("hadith_entries")
    .select(
      "id, collection_id, numbering_system, canonical_number, arabic, isnad, source_url, hadith_collections(name_en, name_ar), hadith_number_variants(numbering_system, number), hadith_translations(translator, language, text, sources(work, license_text)), hadith_gradings(grader, grade, grade_label, citation, note)",
    )
    .eq("collection_id", p.data.collection)
    .eq("canonical_number", p.data.number)
    .eq("status", "published");
  const numbering = req.nextUrl.searchParams.get("numbering");
  if (numbering) query = query.eq("numbering_system", numbering);
  const { data, error } = await query.limit(5);
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "No published narration with that reference.");
  // Different numbering systems can give the same number to different narrations: say so instead of guessing.
  return publicJson({ hadith: data.length === 1 ? data[0] : data, ambiguous: data.length > 1 });
}
