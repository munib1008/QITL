/**
 * TEST FIXTURE for the Story Player's automated tests (unit and Playwright). It is NOT a story: every text is a
 * labelled placeholder, no Quran or hadith wording, no claims about any prophet. It is shown only by the gated
 * /player-fixture route (QITL_E2E_FIXTURES=1) and is tagged DEMO there.
 */
import type { PlayerBundle, PlayerScene } from "./types";

export const FIXTURE_TEXT = "[TEST FIXTURE — placeholder text, not narrative content]";

/** One second of 8 kHz mono silence as a WAV data URI. */
export function silentWav(seconds = 1): string {
  const rate = 8000;
  const n = rate * seconds;
  const buf = new Uint8Array(44 + n);
  const dv = new DataView(buf.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  dv.setUint32(4, 36 + n, true);
  w(8, "WAVE");
  w(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);
  w(36, "data");
  dv.setUint32(40, n, true);
  buf.fill(128, 44);
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

const VOICE = "00000000-0000-4000-8000-000000000001";
const KINDS = ["world", "central_issue", "message", "sequence", "turning_point", "outcome", "lessons", "explore"] as const;

function scenes(prefix: string, withAudio: boolean): PlayerScene[] {
  const wav = withAudio ? silentWav(1) : "";
  return KINDS.map((kind, i) => ({
    id: `00000000-0000-4000-8000-${prefix}${String(i + 1).padStart(12 - prefix.length, "0")}`,
    position: i + 1,
    kind,
    stepRole: kind === "sequence" ? "situation" : null,
    title: `Fixture scene ${i + 1}`,
    text: FIXTURE_TEXT,
    cues: [{ startMs: 0, endMs: 1000, text: `Fixture caption ${i + 1}` }],
    durationMs: 1000,
    animationKey: kind === "world" ? "beginning-timeline" : null,
    ambientKey: withAudio && i === 0 ? "fixture-amb" : null,
    lessons: kind === "lessons" ? ["[TEST FIXTURE — placeholder lesson]"] : [],
    claims:
      kind === "explore"
        ? []
        : [
            {
              id: `00000000-0000-4000-9000-${prefix}${String(i + 1).padStart(12 - prefix.length, "0")}`,
              statement: "[TEST FIXTURE — placeholder claim]",
              evidence: "unknown",
              anchor: null,
              refs: [],
            },
          ],
    audio: withAudio && i < 7 ? [{ voiceId: VOICE, url: wav, durationMs: 1000 }] : [],
  }));
}

export function fixtureBundle({ audio = true }: { audio?: boolean } = {}): PlayerBundle {
  return {
    scripts: [
      {
        id: "00000000-0000-4000-8000-0000000000aa",
        title: "Fixture script",
        language: "en",
        audience: "full",
        version: 1,
        status: "published",
        origin: "human",
        scenes: scenes("a", audio),
        voices: audio ? [{ id: VOICE, label: "Fixture voice", language: "en", style: "neutral" }] : [],
      },
      {
        id: "00000000-0000-4000-8000-0000000000bb",
        title: "Fixture script (ar)",
        language: "ar",
        audience: "full",
        version: 1,
        status: "published",
        origin: "human",
        scenes: scenes("b", false),
        voices: [],
      },
    ],
    ambience: audio
      ? { "fixture-amb": { key: "fixture-amb", label: "Fixture ambience", url: silentWav(1), defaultGain: 0.15, kidsOk: true, note: "[TEST FIXTURE] Ambience is illustrative." } }
      : {},
  };
}
