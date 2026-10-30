import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { AudioQa } from "@/lib/production/schemas";

/**
 * Audio QA by an audio producer: record the pronunciation check, then approve or reject. The database refuses to
 * approve audio without a passed pronunciation check, from an outdated scene version or from an unlicensed voice.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "audio_producer");
  if (isResponse(a)) return a;
  const b = await parseBody(req, AudioQa);
  if (isResponse(b)) return b;
  const patch =
    b.action === "pronunciation"
      ? { pronunciation_ok: b.ok }
      : b.action === "approve"
        ? { status: "approved", approved_by: a.user.id }
        : { status: "rejected" };
  const { data, error } = await a.sb.from("narration_audio").update(patch).eq("id", b.audioId).select("id, status, pronunciation_ok").maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "Audio not found, or you cannot change it.");
  return json({ audio: data });
}
