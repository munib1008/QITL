import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { ProgressPatch } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const a = await requireUser(req, { mutation: false });
  if (isResponse(a)) return a;
  const { data, error } = await a.sb
    .from("reading_progress")
    .select("chapter_id, percent, completed_at, updated_at, chapters(title, position, stories(slug, title))")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return dbError(error);
  return json({ progress: data });
}

/** Progress only moves forward unless the reader resets it explicitly (percent 0). */
export async function PATCH(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const p = await parseBody(req, ProgressPatch);
  if (isResponse(p)) return p;
  const { data: cur } = await a.sb.from("reading_progress").select("percent").eq("chapter_id", p.chapterId).maybeSingle();
  const percent = p.percent === 0 ? 0 : Math.max(Number(cur?.percent ?? 0), p.percent);
  const { data, error } = await a.sb
    .from("reading_progress")
    .upsert({ user_id: a.user.id, chapter_id: p.chapterId, percent }, { onConflict: "user_id,chapter_id" })
    .select("chapter_id, percent, completed_at")
    .single();
  if (error) return dbError(error);
  return json({ progress: data });
}
