/**
 * Reader preferences and progress. Signed-in readers keep them in story_playback_preferences / story_playback_progress
 * (through /api/me/playback/*); everyone else keeps them in this browser's localStorage. Values are always clamped to
 * the same bounds the database enforces, so a stale or hand-edited value can never raise ambience above its cap.
 */
import { z } from "zod";
import { AMBIENT_MAX, clamp } from "./audio";
import { PLAYER_MODES, type PlayerMode } from "./types";

export interface PlaybackPrefs {
  mode: PlayerMode;
  language: string;
  speed: number;
  voiceId: string | null;
  narrationVolume: number;
  ambientVolume: number;
  ambientOn: boolean;
  subtitles: boolean;
  showRefs: boolean;
}

export interface PlaybackProgress {
  scriptId: string;
  sceneId: string | null;
  positionMs: number;
}

export const DEFAULT_PREFS: PlaybackPrefs = {
  mode: "read",
  language: "en",
  speed: 1,
  voiceId: null,
  narrationVolume: 1,
  ambientVolume: 0.15,
  ambientOn: true,
  subtitles: true,
  showRefs: true,
};

export const PREFS_KEY = "qitl-player-prefs";
export const PROGRESS_KEY = "qitl-player-progress:";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sanitizePrefs(raw: unknown): PlaybackPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    mode: (PLAYER_MODES as readonly string[]).includes(r.mode as string) ? (r.mode as PlayerMode) : DEFAULT_PREFS.mode,
    language: typeof r.language === "string" && /^(en|ar|ur|hi)$/.test(r.language) ? r.language : DEFAULT_PREFS.language,
    speed: clamp(num(r.speed, 1), 0.5, 2),
    voiceId: typeof r.voiceId === "string" && uuid.test(r.voiceId) ? r.voiceId : null,
    narrationVolume: clamp(num(r.narrationVolume, 1), 0, 1),
    ambientVolume: clamp(num(r.ambientVolume, DEFAULT_PREFS.ambientVolume), 0, AMBIENT_MAX),
    ambientOn: bool(r.ambientOn, true),
    subtitles: bool(r.subtitles, true),
    showRefs: bool(r.showRefs, true),
  };
}

/** Request schemas, shared by the API routes. */
export const PrefsBody = z.object({
  mode: z.enum(PLAYER_MODES),
  language: z.enum(["en", "ar", "ur", "hi"]),
  speed: z.number().min(0.5).max(2),
  voiceId: z.string().uuid().nullable(),
  narrationVolume: z.number().min(0).max(1),
  ambientVolume: z.number().min(0).max(AMBIENT_MAX),
  ambientOn: z.boolean(),
  subtitles: z.boolean(),
  showRefs: z.boolean(),
});
export const ProgressBody = z.object({
  scriptId: z.string().uuid(),
  sceneId: z.string().uuid().nullable(),
  positionMs: z.number().int().min(0).max(86_400_000),
});

export function prefsToRow(p: PlaybackPrefs, userId: string) {
  return {
    user_id: userId,
    mode: p.mode,
    language: p.language,
    speed: p.speed,
    voice_id: p.voiceId,
    narration_volume: p.narrationVolume,
    ambient_volume: p.ambientVolume,
    ambient_on: p.ambientOn,
    subtitles: p.subtitles,
    show_refs: p.showRefs,
    updated_at: new Date().toISOString(),
  };
}

export function prefsFromRow(r: Record<string, unknown> | null | undefined): PlaybackPrefs | null {
  if (!r) return null;
  return sanitizePrefs({
    mode: r.mode,
    language: r.language,
    speed: r.speed,
    voiceId: r.voice_id,
    narrationVolume: r.narration_volume,
    ambientVolume: r.ambient_volume,
    ambientOn: r.ambient_on,
    subtitles: r.subtitles,
    showRefs: r.show_refs,
  });
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadLocalPrefs(): PlaybackPrefs | null {
  try {
    const v = storage()?.getItem(PREFS_KEY);
    return v ? sanitizePrefs(JSON.parse(v)) : null;
  } catch {
    return null;
  }
}

export function saveLocalPrefs(p: PlaybackPrefs) {
  try {
    storage()?.setItem(PREFS_KEY, JSON.stringify(sanitizePrefs(p)));
  } catch {
    // Private mode or storage full: preferences simply are not remembered.
  }
}

export function loadLocalProgress(scriptId: string): PlaybackProgress | null {
  try {
    const v = storage()?.getItem(PROGRESS_KEY + scriptId);
    if (!v) return null;
    const r = ProgressBody.safeParse(JSON.parse(v));
    return r.success && r.data.scriptId === scriptId ? r.data : null;
  } catch {
    return null;
  }
}

export function saveLocalProgress(p: PlaybackProgress) {
  try {
    storage()?.setItem(PROGRESS_KEY + p.scriptId, JSON.stringify({ ...p, positionMs: Math.max(0, Math.round(p.positionMs)) }));
  } catch {
    // ignore
  }
}

/** Where a reader's state lives: the account when signed in, otherwise this browser. */
export interface PlaybackStore {
  loadPrefs(): Promise<PlaybackPrefs | null>;
  savePrefs(p: PlaybackPrefs): Promise<void>;
  loadProgress(scriptId: string): Promise<PlaybackProgress | null>;
  saveProgress(p: PlaybackProgress): Promise<void>;
}

export const localStore: PlaybackStore = {
  loadPrefs: async () => loadLocalPrefs(),
  savePrefs: async (p) => saveLocalPrefs(p),
  loadProgress: async (id) => loadLocalProgress(id),
  saveProgress: async (p) => saveLocalProgress(p),
};

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error(`playback ${r.status}`);
  return (await r.json()) as Record<string, unknown>;
}

/** Account store. Preferences are mirrored locally too, so a failed request never loses the reader's choice. */
export const accountStore: PlaybackStore = {
  async loadPrefs() {
    try {
      const d = await send("/api/me/playback/preferences", "GET");
      return d.preferences ? sanitizePrefs(d.preferences) : loadLocalPrefs();
    } catch {
      return loadLocalPrefs();
    }
  },
  async savePrefs(p) {
    saveLocalPrefs(p);
    await send("/api/me/playback/preferences", "PUT", sanitizePrefs(p)).catch(() => undefined);
  },
  async loadProgress(scriptId) {
    try {
      const d = await send(`/api/me/playback/progress?scriptId=${encodeURIComponent(scriptId)}`, "GET");
      const r = ProgressBody.safeParse(d.progress);
      return r.success ? r.data : null;
    } catch {
      return loadLocalProgress(scriptId);
    }
  },
  async saveProgress(p) {
    await send("/api/me/playback/progress", "PUT", p).catch(() => saveLocalProgress(p));
  },
};
