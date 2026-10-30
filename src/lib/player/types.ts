/** Story Player data shapes, shared by the server loader, the Studio preview and the client player (no data access). */
import type { EvidenceKind } from "@/content/labels";
import type { Ref } from "@/lib/data/story-types";

export const SCENE_KINDS = ["world", "central_issue", "message", "sequence", "turning_point", "outcome", "lessons", "explore"] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];
export const SCENE_STEP_ROLES = ["situation", "challenge", "action", "response", "consequence"] as const;
export type SceneStepRole = (typeof SCENE_STEP_ROLES)[number];
export const SCRIPT_LANGUAGES = ["en", "ar", "ur", "hi"] as const;
export type ScriptLanguage = (typeof SCRIPT_LANGUAGES)[number];
export const SCRIPT_AUDIENCES = ["kids", "young", "full"] as const;
export type ScriptAudience = (typeof SCRIPT_AUDIENCES)[number];
export const PLAYER_MODES = ["read", "listen", "immersive"] as const;
export type PlayerMode = (typeof PLAYER_MODES)[number];

export interface Cue {
  startMs: number;
  endMs: number;
  text: string;
}

export interface SceneClaim {
  id: string;
  statement: string;
  evidence: EvidenceKind;
  anchor: string | null;
  refs: Ref[];
}

/** One approved narration file for a scene, in one voice. */
export interface SceneAudio {
  voiceId: string;
  url: string;
  durationMs: number;
}

export interface PlayerScene {
  id: string;
  position: number;
  kind: SceneKind;
  stepRole: SceneStepRole | null;
  title: string;
  text: string;
  cues: Cue[];
  durationMs: number | null;
  animationKey: string | null;
  ambientKey: string | null;
  lessons: string[];
  claims: SceneClaim[];
  audio: SceneAudio[];
}

export interface PlayerVoice {
  id: string;
  label: string;
  language: string;
  style: "warm" | "gentle_kids" | "neutral";
}

export interface PlayerAmbience {
  key: string;
  label: string;
  url: string;
  defaultGain: number;
  kidsOk: boolean;
  note: string;
}

export interface PlayerScript {
  id: string;
  title: string;
  language: ScriptLanguage;
  audience: ScriptAudience;
  version: number;
  status: string;
  origin: "human" | "ai_assisted";
  scenes: PlayerScene[];
  voices: PlayerVoice[];
}

/** Every published script for one subject (its languages and audiences), plus the ambience they use. */
export interface PlayerBundle {
  scripts: PlayerScript[];
  ambience: Record<string, PlayerAmbience>;
}

export const hasApprovedAudio = (s: PlayerScript) => s.scenes.some((sc) => sc.audio.length > 0);
