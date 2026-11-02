import { NextResponse, type NextRequest } from "next/server";
import { notConfigured, publicJson } from "@/lib/api";
import { getPublicSupabase } from "@/lib/supabase/server";

/** GET /api/asma/verse?surah=2&ayah=255 -> [{ slug, measure }]: Names whose written form occurs in that verse (a lexical match). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const surah = Number(sp.get("surah"));
  const ayah = Number(sp.get("ayah"));
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || surah < 1 || surah > 114 || ayah < 1 || ayah > 286) return NextResponse.json({ error: "bad verse", code: "bad_request" }, { status: 400 });
  const sb = getPublicSupabase();
  if (!sb) return notConfigured();
  const { data, error } = await sb.rpc("public_asma_lexical_in_verse", { p_surah: surah, p_ayah: ayah });
  if (error) return NextResponse.json({ error: "lookup failed", code: "failed" }, { status: 502 });
  return publicJson(data ?? []);
}
