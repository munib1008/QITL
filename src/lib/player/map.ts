/** Row → player mapping, shared by the public loader (server) and the Studio preview (browser, producer RLS). */
import type { EvidenceKind } from "@/content/labels";
import type { Ref } from "@/lib/data/story-types";
import { parseVtt } from "./vtt";
import type { PlayerAmbience, PlayerScene, PlayerScript, PlayerVoice, SceneKind, SceneStepRole, ScriptAudience, ScriptLanguage } from "./types";

/** Narration and ambience files live in this Supabase Storage bucket (migration 20261031001800). */
export const AUDIO_BUCKET = "narration";

const CLAIM =
  "evidence_claims(id, statement, evidence, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, locator, sources(work), hadith_entries(collection_id, canonical_number), hadith_gradings(grade_label, grader)))";
export const SCRIPT_SELECT =
  "id, title, language, audience, version, status, origin, person_id, event_id, story_scenes(id, position, scene_kind, step_role, title, narration_text, captions_vtt, est_duration_ms, animation_key, ambient_key, lessons, version, " +
  `scene_claim_references(anchor, ${CLAIM}), narration_audio(id, voice_id, storage_path, duration_ms, status, scene_version, narration_voices(id, label, language, style, active)))`;
export const AMBIENCE_SELECT = "key, label, storage_path, default_gain, kids_ok, illustrative_note, approved_by";

interface ClaimRow {
  id: string;
  statement: string;
  evidence: EvidenceKind;
  claim_references: Array<{
    kind: string;
    quran_surah: number | null;
    quran_ayah_from: number | null;
    quran_ayah_to: number | null;
    locator: string | null;
    sources: { work: string } | null;
    hadith_entries: { collection_id: string; canonical_number: string } | null;
    hadith_gradings: { grade_label: string; grader: string } | null;
  }> | null;
}
interface AudioRow {
  id: string;
  voice_id: string;
  storage_path: string;
  duration_ms: number;
  status: string;
  scene_version: number;
  narration_voices: { id: string; label: string; language: string; style: PlayerVoice["style"]; active: boolean } | null;
}
export interface SceneRow {
  id: string;
  position: number;
  scene_kind: SceneKind;
  step_role: SceneStepRole | null;
  title: string;
  narration_text: string;
  captions_vtt: string | null;
  est_duration_ms: number | null;
  animation_key: string | null;
  ambient_key: string | null;
  lessons: string[] | null;
  version: number;
  scene_claim_references: Array<{ anchor: string | null; evidence_claims: ClaimRow | null }> | null;
  narration_audio: AudioRow[] | null;
}
export interface ScriptRow {
  id: string;
  title: string;
  language: ScriptLanguage;
  audience: ScriptAudience;
  version: number;
  status: string;
  origin: "human" | "ai_assisted";
  story_scenes: SceneRow[] | null;
}
export interface AmbienceRow {
  key: string;
  label: string;
  storage_path: string;
  default_gain: number;
  kids_ok: boolean;
  illustrative_note: string;
  approved_by: string | null;
}

function refs(c: ClaimRow): Ref[] {
  return (c.claim_references ?? []).map((r) => ({
    kind: r.kind,
    surah: r.quran_surah,
    from: r.quran_ayah_from,
    to: r.quran_ayah_to,
    locator: r.locator,
    work: r.sources?.work ?? null,
    hadith: r.hadith_entries
      ? { collection: r.hadith_entries.collection_id, number: r.hadith_entries.canonical_number, grade: r.hadith_gradings?.grade_label ?? null, grader: r.hadith_gradings?.grader ?? null }
      : null,
  }));
}

/** Storage paths whose URLs the caller must resolve (signed or public) before mapping. */
export function audioPaths(rows: ScriptRow[]): string[] {
  const out = new Set<string>();
  for (const s of rows) for (const sc of s.story_scenes ?? []) for (const a of usableAudio(sc)) out.add(a.storage_path);
  return [...out];
}

/** Only approved audio, from an active voice, generated from the scene's current text. */
function usableAudio(sc: SceneRow): AudioRow[] {
  return (sc.narration_audio ?? []).filter((a) => a.status === "approved" && a.scene_version === sc.version && a.narration_voices?.active);
}

export function mapScript(row: ScriptRow, url: (path: string) => string | null): PlayerScript {
  const voices = new Map<string, PlayerVoice>();
  const scenes: PlayerScene[] = [...(row.story_scenes ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((sc) => {
      const audio = usableAudio(sc).flatMap((a) => {
        const u = url(a.storage_path);
        if (!u || !a.narration_voices) return [];
        voices.set(a.voice_id, { id: a.voice_id, label: a.narration_voices.label, language: a.narration_voices.language, style: a.narration_voices.style });
        return [{ voiceId: a.voice_id, url: u, durationMs: a.duration_ms }];
      });
      return {
        id: sc.id,
        position: sc.position,
        kind: sc.scene_kind,
        stepRole: sc.step_role,
        title: sc.title,
        text: sc.narration_text,
        cues: parseVtt(sc.captions_vtt),
        durationMs: sc.est_duration_ms,
        animationKey: sc.animation_key,
        ambientKey: sc.ambient_key,
        lessons: sc.lessons ?? [],
        claims: (sc.scene_claim_references ?? []).flatMap((r) =>
          r.evidence_claims ? [{ id: r.evidence_claims.id, statement: r.evidence_claims.statement, evidence: r.evidence_claims.evidence, anchor: r.anchor, refs: refs(r.evidence_claims) }] : [],
        ),
        audio,
      };
    });
  return { id: row.id, title: row.title, language: row.language, audience: row.audience, version: row.version, status: row.status, origin: row.origin, scenes, voices: [...voices.values()] };
}

export function mapAmbience(rows: AmbienceRow[], url: (path: string) => string | null): Record<string, PlayerAmbience> {
  const out: Record<string, PlayerAmbience> = {};
  for (const r of rows) {
    const u = r.approved_by ? url(r.storage_path) : null;
    if (u) out[r.key] = { key: r.key, label: r.label, url: u, defaultGain: Math.min(0.4, Math.max(0, r.default_gain)), kidsOk: r.kids_ok, note: r.illustrative_note };
  }
  return out;
}
