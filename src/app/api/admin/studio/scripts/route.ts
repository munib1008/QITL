import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { ScriptCreate } from "@/lib/production/schemas";

/**
 * Create a human-written script in scenes, as a draft. Editors only (RLS: editor_insert). The text comes from the
 * editor; QITL never writes narrative content itself.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const b = await parseBody(req, ScriptCreate);
  if (isResponse(b)) return b;
  const { data: script, error } = await a.sb
    .from("story_scripts")
    .insert({
      person_id: b.personId ?? null,
      event_id: b.eventId ?? null,
      language: b.language,
      audience: b.audience,
      title: b.title,
      origin: "human",
      status: "draft",
      created_by: a.user.id,
    })
    .select("id, version, status")
    .single();
  if (error) return dbError(error);
  const rows = b.scenes.map((s, i) => ({
    script_id: script.id,
    position: i + 1,
    scene_kind: s.kind,
    step_role: s.stepRole,
    title: s.title,
    narration_text: s.narrationText,
    lessons: s.lessons,
    animation_key: s.animationKey,
    ambient_key: s.ambientKey,
    est_duration_ms: s.estDurationMs,
  }));
  const { data: scenes, error: e2 } = await a.sb.from("story_scenes").insert(rows).select("id, position");
  if (e2) return dbError(e2);
  return json({ script, scenes }, 201);
}
