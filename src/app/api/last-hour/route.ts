import { dbError, notConfigured, publicJson } from "@/lib/api";
import { getServerSupabase } from "@/lib/supabase/server";

/** Signs of the Last Hour: classification and evidence, in text order where the texts give one. Never a date. */
export async function GET() {
  const sb = await getServerSupabase();
  if (!sb) return notConfigured();
  const { data, error } = await sb
    .from("historical_events")
    .select(
      "id, slug, title, title_ar, summary, category, relative_order, date_precision, evidence_claims(id, statement, evidence, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, hadith_id))",
    )
    .in("category", ["last_hour_minor", "last_hour_major"])
    .eq("status", "published")
    .order("relative_order", { ascending: true, nullsFirst: false });
  if (error) return dbError(error);
  return publicJson({ date: null, note: "No date is known. Order follows the texts only where they give one.", signs: data });
}
