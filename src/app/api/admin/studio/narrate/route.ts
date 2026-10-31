import type { NextRequest } from "next/server";
import { dbError, dbThrottle, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { MAX_ATTEMPTS, sha256 } from "@/lib/production/lara";
import { EXT, getNarrationProvider, narrationIdempotencyKey } from "@/lib/production/narration";
import { NarrateRequest } from "@/lib/production/schemas";
import { AUDIO_BUCKET } from "@/lib/player/map";

export const maxDuration = 120;

/**
 * Synthesise one scene in one licensed voice. Identical input (scene + voice + text hash) is never synthesised twice;
 * a failed job is retried in place up to 5 attempts. The file is stored as pending_qa and plays only after an audio
 * producer checks the pronunciation and approves it for the scene's current version.
 */
export async function POST(req: NextRequest) {
  const provider = getNarrationProvider();
  if (!provider) return fail(503, "not_configured", "No narration provider is configured on this deployment.");
  const a = await requireRole(req, "audio_producer");
  if (isResponse(a)) return a;
  const throttled = await dbThrottle(a.sb, "narrate");
  if (throttled) return throttled;
  const b = await parseBody(req, NarrateRequest);
  if (isResponse(b)) return b;

  const [{ data: scene }, { data: voice }] = await Promise.all([
    a.sb.from("story_scenes").select("id, version, narration_text").eq("id", b.sceneId).maybeSingle(),
    a.sb.from("narration_voices").select("id, provider, provider_voice_id, language, style, active").eq("id", b.voiceId).maybeSingle(),
  ]);
  if (!scene) return fail(404, "not_found", "Scene not found.");
  if (!voice) return fail(404, "not_found", "Voice not found.");
  if (!voice.active) return fail(422, "rule", "This voice has no recorded licence and is not active.");
  if (voice.provider !== provider.id) return fail(422, "rule", "This voice belongs to a provider that is not configured.");

  const hash = sha256(scene.narration_text);
  const key = narrationIdempotencyKey(scene.id, voice.id, hash);
  const { data: existing } = await a.sb.from("narration_jobs").select("id, status, attempts").eq("idempotency_key", key).maybeSingle();
  if (existing?.status === "succeeded") return json({ job: existing, reused: true });
  if (existing?.status === "running") return fail(409, "in_progress", "This narration is already running.");
  if (existing && existing.attempts >= MAX_ATTEMPTS) return fail(409, "retries_exhausted", `This narration failed ${MAX_ATTEMPTS} times.`);
  const attempts = (existing?.attempts ?? 0) + 1;
  const { data: job, error: e1 } = existing
    ? await a.sb.from("narration_jobs").update({ status: "running", attempts, error: null }).eq("id", existing.id).select("id").single()
    : await a.sb
        .from("narration_jobs")
        .insert({ scene_id: scene.id, scene_version: scene.version, voice_id: voice.id, text_sha256: hash, idempotency_key: key, status: "running", attempts, requested_by: a.user.id })
        .select("id")
        .single();
  if (e1) return dbError(e1);
  const finish = (patch: Record<string, unknown>) => a.sb.from("narration_jobs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", job.id);

  try {
    const out = await provider.synthesize({ text: scene.narration_text, providerVoiceId: voice.provider_voice_id, language: voice.language, style: voice.style });
    const path = `scenes/${scene.id}/${voice.id}/${hash}.${EXT[out.mimeType]}`;
    const up = await a.sb.storage.from(AUDIO_BUCKET).upload(path, out.audio, { contentType: out.mimeType, upsert: true });
    if (up.error) throw new Error("upload failed");
    const { data: audio, error: e2 } = await a.sb
      .from("narration_audio")
      .insert({ scene_id: scene.id, scene_version: scene.version, voice_id: voice.id, text_sha256: hash, storage_path: path, duration_ms: out.durationMs, bytes: out.audio.byteLength, mime_type: out.mimeType, status: "pending_qa" })
      .select("id, status")
      .single();
    if (e2) throw e2;
    await finish({ status: "succeeded", characters: out.characters });
    return json({ job: { id: job.id, status: "succeeded", attempts }, audio }, 201);
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    await finish({ status: "failed", error: code ? `database ${code}` : "provider error" });
    if (code) return dbError(e as { code?: string; message?: string });
    return fail(502, "provider_error", "The narration provider failed; the job can be retried.");
  }
}
