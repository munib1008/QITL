import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireAnyRole } from "@/lib/admin";
import { MAX_ATTEMPTS, countCharacters, getLaraEngine, laraConfigured, translationIdempotencyKey } from "@/lib/production/lara";
import { TranslateRequest } from "@/lib/production/schemas";

export const maxDuration = 120;

interface SceneRow {
  position: number;
  scene_kind: string;
  step_role: string | null;
  title: string;
  narration_text: string;
  lessons: string[] | null;
  animation_key: string | null;
  ambient_key: string | null;
  est_duration_ms: number | null;
}

/**
 * Translate an approved script with Lara into a new DRAFT script in the target language. One job per
 * (script, version, language): a succeeded job is returned as is, a failed one is retried in place, at most 5 attempts.
 * The translation then needs a linguistic and a religious review of its own before it can publish.
 */
export async function POST(req: NextRequest) {
  if (!laraConfigured()) return fail(503, "not_configured", "Translation is not configured: set LARA_ACCESS_KEY_ID and LARA_ACCESS_KEY_SECRET.");
  const a = await requireAnyRole(req, ["editor", "translation_reviewer"]);
  if (isResponse(a)) return a;
  const b = await parseBody(req, TranslateRequest);
  if (isResponse(b)) return b;

  const { data: src, error: e1 } = await a.sb
    .from("story_scripts")
    .select(
      "id, title, language, audience, version, status, person_id, event_id, creation_slug, translated_from, story_scenes(position, scene_kind, step_role, title, narration_text, lessons, animation_key, ambient_key, est_duration_ms)",
    )
    .eq("id", b.scriptId)
    .maybeSingle();
  if (e1) return dbError(e1);
  if (!src) return fail(404, "not_found", "Script not found.");
  if (src.translated_from) return fail(422, "rule", "Translate from the source script, not from a translation.");
  if (!["approved", "published"].includes(src.status)) return fail(422, "rule", "Only an approved or published script is translated.");
  if (src.language === b.targetLanguage) return fail(422, "rule", "The script is already in that language.");

  const key = translationIdempotencyKey(src.id, src.version, b.targetLanguage);
  const { data: existing } = await a.sb.from("translation_jobs").select("id, status, attempts, result_script_id").eq("idempotency_key", key).maybeSingle();
  if (existing?.status === "succeeded") return json({ job: existing, reused: true });
  if (existing?.status === "running") return fail(409, "in_progress", "This translation is already running.");
  if (existing && existing.attempts >= MAX_ATTEMPTS) return fail(409, "retries_exhausted", `This translation failed ${MAX_ATTEMPTS} times; fix the cause before retrying.`);

  const attempts = (existing?.attempts ?? 0) + 1;
  const { data: job, error: e2 } = existing
    ? await a.sb.from("translation_jobs").update({ status: "running", attempts, error: null }).eq("id", existing.id).select("id").single()
    : await a.sb
        .from("translation_jobs")
        .insert({ script_id: src.id, script_version: src.version, target_language: b.targetLanguage, engine: "lara", idempotency_key: key, status: "running", attempts, requested_by: a.user.id })
        .select("id")
        .single();
  if (e2) return dbError(e2);

  const scenes = ([...(src.story_scenes ?? [])] as SceneRow[]).sort((x, y) => x.position - y.position);
  const texts = [src.title as string, ...scenes.flatMap((s) => [s.title, s.narration_text, ...(s.lessons ?? [])])];
  const characters = countCharacters(texts);
  const finish = (patch: Record<string, unknown>) => a.sb.from("translation_jobs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", job.id);

  try {
    const engine = await getLaraEngine();
    if (!engine) return fail(503, "not_configured", "Translation is not configured.");
    const { data: gl } = await a.sb.from("translation_glossary").select("lara_glossary_id").eq("status", "published").not("lara_glossary_id", "is", null);
    const glossaries = [...new Set((gl ?? []).map((g: { lara_glossary_id: string }) => g.lara_glossary_id))];
    const out = await engine.translate(texts, src.language, b.targetLanguage, { glossaries });
    let k = 0;
    const next = () => out[k++] ?? "";
    const title = next();
    const { data: tr, error: e3 } = await a.sb
      .from("story_scripts")
      .insert({
        person_id: src.person_id,
        event_id: src.event_id,
        creation_slug: src.creation_slug,
        language: b.targetLanguage,
        audience: src.audience,
        title: title.slice(0, 200),
        origin: "ai_assisted",
        model: "lara",
        prompt_version: engine.detail,
        translated_from: src.id,
        translated_from_version: src.version,
        status: "draft",
        created_by: a.user.id,
      })
      .select("id")
      .single();
    if (e3) throw e3;
    const rows = scenes.map((s) => {
      const sceneTitle = next();
      const text = next();
      const lessons = (s.lessons ?? []).map(() => next());
      return {
        script_id: tr.id,
        position: s.position,
        scene_kind: s.scene_kind,
        step_role: s.step_role,
        title: sceneTitle.slice(0, 200),
        narration_text: text.slice(0, 5000),
        lessons,
        animation_key: s.animation_key,
        ambient_key: s.ambient_key,
        est_duration_ms: s.est_duration_ms,
      };
    });
    const { error: e4 } = await a.sb.from("story_scenes").insert(rows);
    if (e4) throw e4;
    const { error: e5 } = await a.sb.from("story_translations").insert({
      source_script_id: src.id,
      source_version: src.version,
      translated_script_id: tr.id,
      target_language: b.targetLanguage,
      engine: "lara",
      engine_detail: engine.detail,
      translator_id: a.user.id,
    });
    if (e5) throw e5;
    await finish({ status: "succeeded", characters, result_script_id: tr.id });
    return json({ job: { id: job.id, status: "succeeded", attempts, characters, result_script_id: tr.id } }, 201);
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    // Engine messages can echo request details; only a short, generic reason is stored.
    await finish({ status: "failed", characters, error: code ? `database ${code}` : "engine error" });
    if (code) return dbError(e as { code?: string; message?: string });
    return fail(502, "engine_error", "The translation engine failed; the job can be retried.");
  }
}
