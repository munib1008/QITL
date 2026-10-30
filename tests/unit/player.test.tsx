import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StoryPlayer, pickScript } from "@/components/player/StoryPlayer";
import { AMBIENT_MAX, DUCK_FACTOR, KIDS_AMBIENT_MAX, ambientGain, narrationGain } from "@/lib/player/audio";
import { DEFAULT_PREFS, PREFS_KEY, PROGRESS_KEY, loadLocalPrefs, loadLocalProgress, prefsFromRow, prefsToRow, sanitizePrefs, saveLocalPrefs, saveLocalProgress } from "@/lib/player/prefs";
import { cueAt, parseVtt } from "@/lib/player/vtt";
import { fixtureBundle } from "@/lib/player/fixture";
import { mapAmbience, mapScript, type ScriptRow } from "@/lib/player/map";

/* ---------- Web Audio and media element doubles ---------- */
const ctxInstances: FakeContext[] = [];
class FakeGain {
  gain = { value: 1, setTargetAtTime: vi.fn((v: number) => (this.gain.value = v)) };
  connect = (n: unknown) => n;
}
class FakeContext {
  state = "running";
  currentTime = 0;
  destination = {};
  gains: FakeGain[] = [];
  constructor() {
    ctxInstances.push(this);
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createMediaElementSource() {
    return { connect: (n: unknown) => n };
  }
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
}

let play: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  ctxInstances.length = 0;
  localStorage.clear();
  vi.stubGlobal("AudioContext", FakeContext);
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("play"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("pause"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ducking and volume math", () => {
  test("ambience is capped at 0.4 and ducked while narration plays", () => {
    expect(ambientGain({ volume: 0.3, on: true, narrating: false })).toBeCloseTo(0.3);
    expect(ambientGain({ volume: 0.3, on: true, narrating: true })).toBeCloseTo(0.3 * DUCK_FACTOR);
    expect(ambientGain({ volume: 1, on: true, narrating: false })).toBe(AMBIENT_MAX);
    expect(ambientGain({ volume: 1, on: true, narrating: true })).toBeCloseTo(AMBIENT_MAX * DUCK_FACTOR);
    expect(ambientGain({ volume: 0.3, on: false, narrating: false })).toBe(0);
  });
  test("kids mode is gentler; bad numbers never raise the level", () => {
    expect(ambientGain({ volume: 0.4, on: true, narrating: false, kids: true })).toBe(KIDS_AMBIENT_MAX);
    expect(ambientGain({ volume: Number.NaN, on: true, narrating: false })).toBe(0);
    expect(ambientGain({ volume: -1, on: true, narrating: false })).toBe(0);
    expect(narrationGain(2)).toBe(1);
    expect(narrationGain(-0.5)).toBe(0);
  });
  test("ducked ambience is always quieter than full narration", () => {
    for (let v = 0; v <= 1; v += 0.1) expect(ambientGain({ volume: v, on: true, narrating: true })).toBeLessThan(narrationGain(1));
  });
});

describe("captions", () => {
  test("parses WebVTT and finds the cue at a time", () => {
    const cues = parseVtt("WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.500\n<v N>First</v>\n\n00:00:01.500 --> 00:00:03.000 align:start\nSecond\n\nbroken --> nonsense\nx");
    expect(cues).toEqual([
      { startMs: 0, endMs: 1500, text: "First" },
      { startMs: 1500, endMs: 3000, text: "Second" },
    ]);
    expect(cueAt(cues, 2000)?.text).toBe("Second");
    expect(cueAt(cues, 5000)).toBeNull();
    expect(parseVtt("not vtt")).toEqual([]);
  });
});

describe("preferences and progress persistence", () => {
  test("sanitising clamps every value to the database bounds", () => {
    const p = sanitizePrefs({ mode: "loud", speed: 9, ambientVolume: 3, narrationVolume: -2, voiceId: "x", language: "fr" });
    expect(p).toMatchObject({ mode: "read", speed: 2, ambientVolume: AMBIENT_MAX, narrationVolume: 0, voiceId: null, language: "en" });
  });
  test("local preferences and progress round-trip", () => {
    saveLocalPrefs({ ...DEFAULT_PREFS, mode: "listen", speed: 1.25, ambientOn: false });
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toMatchObject({ mode: "listen", speed: 1.25 });
    expect(loadLocalPrefs()).toMatchObject({ mode: "listen", speed: 1.25, ambientOn: false });
    const scriptId = "00000000-0000-4000-8000-0000000000aa";
    saveLocalProgress({ scriptId, sceneId: "00000000-0000-4000-8000-a00000000003", positionMs: 1234.6 });
    expect(loadLocalProgress(scriptId)).toEqual({ scriptId, sceneId: "00000000-0000-4000-8000-a00000000003", positionMs: 1235 });
    localStorage.setItem(PROGRESS_KEY + scriptId, "{bad json");
    expect(loadLocalProgress(scriptId)).toBeNull();
  });
  test("database rows map both ways", () => {
    const row = prefsToRow({ ...DEFAULT_PREFS, showRefs: false }, "u1");
    expect(row).toMatchObject({ user_id: "u1", show_refs: false, ambient_volume: 0.15 });
    expect(prefsFromRow(row)).toMatchObject({ showRefs: false, ambientVolume: 0.15 });
  });
});

describe("row mapping", () => {
  test("only approved audio of the current scene version from an active voice is playable", () => {
    const voice = { id: "v", label: "V", language: "en", style: "warm" as const, active: true };
    const row: ScriptRow = {
      id: "s",
      title: "T",
      language: "en",
      audience: "full",
      version: 2,
      status: "published",
      origin: "human",
      story_scenes: [
        {
          id: "sc",
          position: 1,
          scene_kind: "world",
          step_role: null,
          title: "t",
          narration_text: "x",
          captions_vtt: null,
          est_duration_ms: null,
          animation_key: null,
          ambient_key: null,
          lessons: null,
          version: 2,
          scene_claim_references: [],
          narration_audio: [
            { id: "a1", voice_id: "v", storage_path: "ok", duration_ms: 1, status: "approved", scene_version: 2, narration_voices: voice },
            { id: "a2", voice_id: "v", storage_path: "old", duration_ms: 1, status: "approved", scene_version: 1, narration_voices: voice },
            { id: "a3", voice_id: "v", storage_path: "qa", duration_ms: 1, status: "pending_qa", scene_version: 2, narration_voices: voice },
            { id: "a4", voice_id: "v", storage_path: "stale", duration_ms: 1, status: "stale", scene_version: 2, narration_voices: voice },
          ],
        },
      ],
    };
    const s = mapScript(row, (p) => `https://x/${p}`);
    expect(s.scenes[0]!.audio.map((a) => a.url)).toEqual(["https://x/ok"]);
    expect(s.voices).toHaveLength(1);
    const amb = mapAmbience(
      [
        { key: "a", label: "A", storage_path: "a", default_gain: 0.9, kids_ok: true, illustrative_note: "n", approved_by: "u" },
        { key: "b", label: "B", storage_path: "b", default_gain: 0.1, kids_ok: true, illustrative_note: "n", approved_by: null },
      ],
      (p) => p,
    );
    expect(Object.keys(amb)).toEqual(["a"]);
    expect(amb.a!.defaultGain).toBe(0.4);
  });
  test("picks the script for the reader's language and audience", () => {
    const b = fixtureBundle();
    expect(pickScript(b.scripts, "ar", false)?.language).toBe("ar");
    expect(pickScript(b.scripts, "ur", false)).toBeUndefined();
  });
});

describe("StoryPlayer", () => {
  test("never autoplays: no media play and no AudioContext on load or on choosing Listen", async () => {
    render(<StoryPlayer bundle={fixtureBundle()} locale="en" />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Listen" }));
    await act(async () => undefined);
    expect(play).not.toHaveBeenCalled();
    expect(ctxInstances).toHaveLength(0);
    for (const el of document.querySelectorAll("audio")) {
      expect(el.autoplay).toBe(false);
      expect(el.getAttribute("preload")).toBe("none");
    }
  });

  test("Play builds the audio graph inside the click and ducks ambience under narration", async () => {
    render(<StoryPlayer bundle={fixtureBundle()} locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Listen" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Play narration" }));
    });
    expect(ctxInstances).toHaveLength(1);
    expect(play).toHaveBeenCalled();
    const [narr, amb] = ctxInstances[0]!.gains;
    expect(narr!.gain.value).toBe(1);
    expect(amb!.gain.value).toBeCloseTo(DEFAULT_PREFS.ambientVolume * DUCK_FACTOR);
    expect(await screen.findByRole("button", { name: "Pause narration" })).toBeInTheDocument();
  });

  test("controls are labelled and reachable by role", async () => {
    render(<StoryPlayer bundle={fixtureBundle()} locale="en" />);
    const modes = screen.getByRole("group", { name: "Mode" });
    expect(within(modes).getByRole("button", { name: "Read" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(modes).getByRole("button", { name: "Listen" }));
    for (const name of ["Play narration", "Replay scene", "Previous scene", "Next scene"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Narration volume" })).toHaveAttribute("max", "1");
    expect(screen.getByRole("slider", { name: "Ambience volume" })).toHaveAttribute("max", String(AMBIENT_MAX));
    for (const name of ["Ambience", "Subtitles", "Show references"]) expect(screen.getByRole("checkbox", { name })).toBeInTheDocument();
    for (const name of ["Playback speed", "Voice", "Language"]) expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous scene" })).toBeDisabled();
  });

  test("language choices are limited to approved audio in Listen mode", () => {
    render(<StoryPlayer bundle={fixtureBundle()} locale="en" />);
    const lang = () => within(screen.getByRole("combobox", { name: "Language" })).getAllByRole("option").map((o) => o.textContent);
    expect(lang()).toEqual(["English", "العربية"]);
    fireEvent.click(screen.getByRole("button", { name: "Listen" }));
    expect(lang()).toEqual(["English"]);
  });

  test("with no approved audio, Listen and Immersive say so plainly and offer no Play", () => {
    render(<StoryPlayer bundle={fixtureBundle({ audio: false })} locale="en" />);
    for (const mode of ["Listen", "Immersive"]) {
      fireEvent.click(screen.getByRole("button", { name: mode }));
      expect(screen.getByRole("status")).toHaveTextContent("No approved narration exists for this story yet.");
      expect(screen.queryByRole("button", { name: "Play narration" })).toBeNull();
    }
  });

  test("preferences persist for a signed-out reader and are restored", async () => {
    const { unmount } = render(<StoryPlayer bundle={fixtureBundle()} locale="en" />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Listen" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Playback speed" }), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Subtitles" }));
    expect(loadLocalPrefs()).toMatchObject({ mode: "listen", speed: 1.5, subtitles: false });
    unmount();
    render(<StoryPlayer bundle={fixtureBundle()} locale="en" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Listen" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("combobox", { name: "Playback speed" })).toHaveValue("1.5");
  });

  test("scene navigation saves progress locally and resumes there", async () => {
    const b = fixtureBundle();
    const { unmount } = render(<StoryPlayer bundle={b} locale="en" />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Next scene" }));
    fireEvent.click(screen.getByRole("button", { name: "Next scene" }));
    expect(screen.getByRole("heading", { name: "Fixture scene 3" })).toBeInTheDocument();
    expect(loadLocalProgress(b.scripts[0]!.id)?.sceneId).toBe(b.scripts[0]!.scenes[2]!.id);
    unmount();
    render(<StoryPlayer bundle={b} locale="en" />);
    expect(await screen.findByRole("heading", { name: "Fixture scene 3" })).toBeInTheDocument();
    expect(screen.getByText("Resuming at scene 3.")).toBeInTheDocument();
  });

  test("Studio preview neither reads nor writes reader state", async () => {
    saveLocalPrefs({ ...DEFAULT_PREFS, mode: "listen" });
    render(<StoryPlayer bundle={fixtureBundle()} locale="en" preview />);
    await act(async () => undefined);
    expect(screen.getByRole("button", { name: "Read" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Immersive" }));
    expect(loadLocalPrefs()?.mode).toBe("listen");
  });

  test("Arabic interface: Arabic labels and right-to-left layout; kids mode is gentle", () => {
    const { container } = render(<StoryPlayer bundle={fixtureBundle()} locale="ar" kids />);
    const root = container.querySelector(".qp")!;
    expect(root).toHaveAttribute("dir", "rtl");
    expect(root).toHaveClass("qp-kids");
    expect(screen.getByRole("button", { name: "استماع" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "استماع" }));
    expect(screen.getByRole("slider", { name: "مستوى صوت الأجواء" })).toHaveAttribute("max", String(KIDS_AMBIENT_MAX));
  });

  test("the evidence bottom sheet is a modal dialog that Escape closes", () => {
    render(<StoryPlayer bundle={fixtureBundle()} locale="en" />);
    const opener = screen.getByRole("button", { name: "Evidence and lessons" });
    opener.focus();
    fireEvent.click(opener);
    const dlg = screen.getByRole("dialog", { name: "Evidence and lessons" });
    expect(dlg).toHaveAttribute("aria-modal", "true");
    expect(within(dlg).getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});
