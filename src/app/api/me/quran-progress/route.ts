import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { surahList } from "@/content/quran";

/** The last-read ayah of one surah. The ayah must exist in the pinned source (its count from surahs.json). */
const QuranProgressPut = z.object({ surah: z.number().int().min(1).max(114), ayah: z.number().int().min(1).max(286) }).strict();

/** GET → the reader's last-read ayah per surah, most recent first. RLS limits rows to the owner. */
export async function GET(req: NextRequest) {
  const a = await requireUser(req, { mutation: false });
  if (isResponse(a)) return a;
  const { data, error } = await a.sb.from("quran_reading_progress").select("surah, ayah, updated_at").order("updated_at", { ascending: false }).limit(114);
  if (error) return dbError(error);
  return json({ progress: data });
}

/** PUT {surah, ayah} → records where the reader is. It follows the reader (backwards too): it is a place, not a score. */
export async function PUT(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const p = await parseBody(req, QuranProgressPut);
  if (isResponse(p)) return p;
  const max = surahList()?.[p.surah - 1]?.ayahs;
  if (max && p.ayah > max) return fail(422, "invalid", `Surah ${p.surah} has ${max} ayat.`);
  const { data, error } = await a.sb
    .from("quran_reading_progress")
    .upsert({ user_id: a.user.id, surah: p.surah, ayah: p.ayah }, { onConflict: "user_id,surah" })
    .select("surah, ayah, updated_at")
    .single();
  if (error) return dbError(error);
  return json({ progress: data });
}
