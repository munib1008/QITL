import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { AmbienceRequest } from "@/lib/production/schemas";

/**
 * The ambience registry (audio producers). An entry names a licensed file in the narration bucket and its default gain
 * (never above 0.4); readers hear it only after it is approved.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "audio_producer");
  if (isResponse(a)) return a;
  const b = await parseBody(req, AmbienceRequest);
  if (isResponse(b)) return b;
  if (b.action === "approve") {
    const { data, error } = await a.sb.from("scene_ambient_audio").update({ approved_by: a.user.id }).eq("key", b.key).select("key, approved_by").maybeSingle();
    if (error) return dbError(error);
    if (!data) return fail(404, "not_found", "Ambience not found.");
    return json({ ambience: data });
  }
  const { data, error } = await a.sb
    .from("scene_ambient_audio")
    .insert({ key: b.key, label: b.label, storage_path: b.storagePath, licence_source_id: b.licenceSourceId, default_gain: b.defaultGain, kids_ok: b.kidsOk })
    .select("key")
    .single();
  if (error) return dbError(error);
  return json({ ambience: data }, 201);
}
