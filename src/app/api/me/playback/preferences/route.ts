import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { PrefsBody, prefsFromRow, prefsToRow } from "@/lib/player/prefs";

/** The signed-in reader's Story Player preferences (story_playback_preferences; RLS: own row only). */
export async function GET(req: NextRequest) {
  const a = await requireUser(req, { mutation: false });
  if (isResponse(a)) return a;
  const { data, error } = await a.sb.from("story_playback_preferences").select("*").eq("user_id", a.user.id).maybeSingle();
  if (error) return dbError(error);
  return json({ preferences: prefsFromRow(data) });
}

export async function PUT(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const p = await parseBody(req, PrefsBody);
  if (isResponse(p)) return p;
  const { data, error } = await a.sb.from("story_playback_preferences").upsert(prefsToRow(p, a.user.id), { onConflict: "user_id" }).select("*").single();
  if (error) return dbError(error);
  return json({ preferences: prefsFromRow(data) });
}
