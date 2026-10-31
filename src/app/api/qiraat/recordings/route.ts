import type { NextRequest } from "next/server";
import { z } from "zod";
import { isResponse, parseQuery, publicJson } from "@/lib/api";
import { getRecordings } from "@/lib/qiraat/data";
import { RIWAYAH_IDS } from "@/lib/qiraat/model";

const Query = z.object({
  riwayah: z.enum(RIWAYAH_IDS as [string, ...string[]]),
  surah: z.coerce.number().int().min(1).max(114),
});

/**
 * Approved recordings for one riwayah and surah (anonymous; RLS returns only published recordings whose permission
 * allows display). Without a database, or on a failed read, the list is empty and the reader shows its plain statement.
 */
export async function GET(req: NextRequest) {
  const q = parseQuery(req, Query);
  if (isResponse(q)) return q;
  const r = await getRecordings(q.riwayah, q.surah);
  return publicJson({ state: r.state, recordings: r.state === "ok" ? r.data : [] });
}
