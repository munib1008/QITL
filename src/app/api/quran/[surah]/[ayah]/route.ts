import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, publicJson } from "@/lib/api";
import { ayahArabic, quranSource } from "@/content/quran";
import { getServerSupabase } from "@/lib/supabase/server";

const P = z.object({ surah: z.coerce.number().int().min(1).max(114), ayah: z.coerce.number().int().min(1).max(286) });

/** One ayah: Arabic from the verified source, plus only translations whose licence is cleared (RLS). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ surah: string; ayah: string }> }) {
  const p = P.safeParse(await params);
  if (!p.success) return fail(404, "not_found", "Not found.");
  const { surah, ayah } = p.data;
  const src = quranSource();
  if (!src) return fail(503, "source_not_imported", "The verified Quran text has not been imported on this deployment yet.");
  const arabic = ayahArabic(surah, ayah);
  if (!arabic) return fail(404, "not_found", `Q ${surah}:${ayah} does not exist.`);
  let translations: unknown[] = [];
  const sb = await getServerSupabase();
  if (sb) {
    const { data } = await sb
      .from("quran_translations")
      .select("translator, edition, language, text, sources(work, license_text, attribution)")
      .eq("surah_id", surah)
      .eq("ayah_no", ayah);
    translations = data ?? [];
  }
  return publicJson(
    { reference: `Q ${surah}:${ayah}`, arabic, source: { name: src.source, version: src.version, license: src.license, url: src.url }, translations },
    86400,
  );
}
