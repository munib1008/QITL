/**
 * The player's sound: two Web Audio gain nodes, one for narration and one for ambience. Ambience never overpowers
 * narration: its volume is capped at AMBIENT_MAX (the same 0.4 cap as scene_ambient_audio.default_gain) and it is
 * ducked to DUCK_FACTOR of its level while narration plays. Nothing is created or played until the reader presses
 * Play: an AudioContext is built only inside a user gesture, so the page never autoplays.
 */
export const AMBIENT_MAX = 0.4;
export const KIDS_AMBIENT_MAX = 0.2;
export const DUCK_FACTOR = 0.3;
/** Seconds for the gain to glide to its target (a time constant, so the change is click-free). */
export const DUCK_RAMP_S = 0.25;
export const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

export const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

export function narrationGain(volume: number): number {
  return clamp(volume, 0, 1);
}

/** The ambience gain for the current state: off, capped, and ducked while narration is playing. */
export function ambientGain(opts: { volume: number; on: boolean; narrating: boolean; kids?: boolean }): number {
  if (!opts.on) return 0;
  const cap = opts.kids ? KIDS_AMBIENT_MAX : AMBIENT_MAX;
  const base = clamp(opts.volume, 0, cap);
  return opts.narrating ? base * DUCK_FACTOR : base;
}

export function clampSpeed(s: number): number {
  return clamp(s, 0.5, 2);
}

type Ctor = new () => AudioContext;

/** A small wrapper over the graph. Construct it only from a click handler. */
export class PlayerAudioGraph {
  readonly ctx: AudioContext;
  readonly narration: HTMLAudioElement;
  readonly ambience: HTMLAudioElement;
  private readonly nGain: GainNode;
  private readonly aGain: GainNode;

  constructor(narration: HTMLAudioElement, ambience: HTMLAudioElement, Ctx?: Ctor) {
    const C = Ctx ?? (globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }).AudioContext ?? (globalThis as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!C) throw new Error("Web Audio is not available");
    this.ctx = new C();
    this.narration = narration;
    this.ambience = ambience;
    this.nGain = this.ctx.createGain();
    this.aGain = this.ctx.createGain();
    this.ctx.createMediaElementSource(narration).connect(this.nGain).connect(this.ctx.destination);
    this.ctx.createMediaElementSource(ambience).connect(this.aGain).connect(this.ctx.destination);
    this.aGain.gain.value = 0;
  }

  setNarration(volume: number) {
    this.nGain.gain.setTargetAtTime(narrationGain(volume), this.ctx.currentTime, 0.05);
  }

  setAmbient(gain: number) {
    this.aGain.gain.setTargetAtTime(clamp(gain, 0, AMBIENT_MAX), this.ctx.currentTime, DUCK_RAMP_S);
  }

  async resume() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  close() {
    this.narration.pause();
    this.ambience.pause();
    void this.ctx.close().catch(() => undefined);
  }
}
