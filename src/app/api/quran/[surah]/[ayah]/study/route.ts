import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, publicJson } from "@/lib/api";
import { getPublicSupabase } from "@/lib/supabase/server";
import { loadStudy } from "@/lib/interpretation/study";

const P = z.object({ surah: z.coerce.number().int().min(1).max(114), ayah: z.coerce.number().int().min(1).max(286) });

/**
 * The Study panel's data for one ayah: registered editions (with their licence state), licensed text only, word by
 * word, differences, tafsir, linked narrations and published QITL summaries. Public, cookie-free, RLS-limited.
 * Works without the database: it then says so (configured: false) and every tab shows its "not imported" state.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ surah: string; ayah: string }> }) {
  const p = P.safeParse(await params);
  if (!p.success) return fail(404, "not_found", "Not found.");
  const data = await loadStudy(getPublicSupabase(), p.data.surah, p.data.ayah);
  return publicJson(data, 300);
}
