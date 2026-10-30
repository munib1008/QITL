import "server-only";

/**
 * Text-to-speech narration behind a provider interface. No provider ships with QITL: a licensed provider is added by
 * implementing NarrationProvider and registering it in PROVIDERS, with its voice licence recorded on
 * narration_voices.licence_source_id. Until then every narration request answers 503 not_configured.
 * Audio a provider produces is stored as pending_qa and is never played until an audio producer approves it.
 */
export interface SynthesisResult {
  audio: Uint8Array;
  mimeType: "audio/mpeg" | "audio/ogg" | "audio/webm" | "audio/wav";
  durationMs: number;
  characters: number;
}

export interface NarrationProvider {
  /** Matches narration_voices.provider. */
  readonly id: string;
  synthesize(input: { text: string; providerVoiceId: string; language: string; style: string }): Promise<SynthesisResult>;
}

/** Registered providers, keyed by id. Empty on purpose. */
const PROVIDERS: Record<string, () => NarrationProvider | null> = {};

/** NARRATION_PROVIDER names the provider to use; it must also be registered above. */
export function getNarrationProvider(env: NodeJS.ProcessEnv = process.env): NarrationProvider | null {
  const id = env.NARRATION_PROVIDER;
  if (!id) return null;
  return PROVIDERS[id]?.() ?? null;
}

export function narrationIdempotencyKey(sceneId: string, voiceId: string, textSha256: string): string {
  return `${sceneId}:${voiceId}:${textSha256}`;
}

export const EXT: Record<SynthesisResult["mimeType"], string> = { "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/webm": "webm", "audio/wav": "wav" };
