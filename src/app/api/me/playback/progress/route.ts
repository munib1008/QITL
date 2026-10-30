import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, json, parseBody, parseQuery, requireUser } from "@/lib/api";
import { ProgressBody } from "@/lib/player/prefs";

const Query = z.object({ scriptId: z.string().uuid() });

/** Where the signed-in reader stopped in a script (story_playback_progress; RLS: own rows only). */
export async function GET(req: NextRequest) {
  const a = await requireUser(req, { mutation: false });
  if (isResponse(a)) return a;
  const q = parseQuery(req, Query);
  if (isResponse(q)) return q;
  const { data, error } = await a.sb
    .from("story_playback_progress")
    .select("script_id, scene_id, position_ms")
    .eq("user_id", a.user.id)
    .eq("script_id", q.scriptId)
    .maybeSingle();
  if (error) return dbError(error);
  return json({ progress: data ? { scriptId: data.script_id, sceneId: data.scene_id, positionMs: data.position_ms } : null });
}

export async function PUT(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const p = await parseBody(req, ProgressBody);
  if (isResponse(p)) return p;
  const { error } = await a.sb
    .from("story_playback_progress")
    .upsert({ user_id: a.user.id, script_id: p.scriptId, scene_id: p.sceneId, position_ms: p.positionMs, updated_at: new Date().toISOString() }, { onConflict: "user_id,script_id" });
  if (error) return dbError(error);
  return json({ progress: p });
}
