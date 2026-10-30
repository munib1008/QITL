"use client";

import "@/styles/player.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimationPlayer, ANIMATION_LABELS } from "@/components/story/AnimationPlayer";
import { useSession } from "@/components/account/useSession";
import { getPlayerStrings } from "@/lib/i18n/modules/player";
import { PlayerAudioGraph, SPEEDS, ambientGain, narrationGain, AMBIENT_MAX, KIDS_AMBIENT_MAX } from "@/lib/player/audio";
import { DEFAULT_PREFS, accountStore, localStore, sanitizePrefs, type PlaybackPrefs, type PlaybackStore } from "@/lib/player/prefs";
import { cueAt } from "@/lib/player/vtt";
import { PLAYER_MODES, hasApprovedAudio, type PlayerBundle, type PlayerMode, type PlayerScript } from "@/lib/player/types";
import { BottomSheet, ClaimRefs, EvidencePanel } from "./EvidencePanel";

const RTL = new Set(["ar", "ur"]);
const SAVE_EVERY_MS = 15_000;

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

/** The script for a language: the reader's audience first (kids or full), then any audience in that language. */
export function pickScript(scripts: PlayerScript[], language: string, kids: boolean): PlayerScript | undefined {
  const inLang = scripts.filter((s) => s.language === language);
  const pref = kids ? "kids" : "full";
  return inLang.find((s) => s.audience === pref) ?? inLang[0];
}

export interface StoryPlayerProps {
  bundle: PlayerBundle;
  /** Interface language (the route locale). */
  locale: string;
  /** Kids mode: gentle motion and quieter ambience. Also on when the script's audience is kids. */
  kids?: boolean;
  /** Studio preview: no preferences or progress are read or written. */
  preview?: boolean;
}

/**
 * The QITL Story Player: Read, Listen and Immersive modes over a published script. Nothing plays until the reader
 * presses Play. Narration and ambience run through separate gain nodes; ambience is capped and ducked under narration.
 */
export function StoryPlayer({ bundle, locale, kids: kidsProp = false, preview = false }: StoryPlayerProps) {
  const t = getPlayerStrings(locale).player;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const session = useSession();
  const store: PlaybackStore = session.status === "signed_in" ? accountStore : localStore;
  const reduceMotion = useReducedMotion();

  const first = bundle.scripts[0]!;
  const [prefs, setPrefs] = useState<PlaybackPrefs>({ ...DEFAULT_PREFS, language: first.language });
  const loaded = useRef(false);
  const kidsPreferred = kidsProp || first.audience === "kids";
  const script = pickScript(bundle.scripts, prefs.language, kidsPreferred) ?? first;
  const kids = kidsProp || script.audience === "kids";
  const scenes = script.scenes;
  const [index, setIndex] = useState(0);
  const scene = scenes[Math.min(index, scenes.length - 1)]!;
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const nRef = useRef<HTMLAudioElement>(null);
  const aRef = useRef<HTMLAudioElement>(null);
  const graph = useRef<PlayerAudioGraph | null>(null);
  const continueAfterLoad = useRef(false);
  const resumeAt = useRef<number | null>(null);
  const lastSave = useRef(0);

  const audioScripts = bundle.scripts.filter(hasApprovedAudio);
  const languages = [...new Set((prefs.mode === "read" ? bundle.scripts : audioScripts).map((s) => s.language))];
  const scriptHasAudio = hasApprovedAudio(script);
  const voices = script.voices;
  const voiceId = voices.some((v) => v.id === prefs.voiceId) ? prefs.voiceId : (voices[0]?.id ?? null);
  const track = scene.audio.find((a) => a.voiceId === voiceId) ?? scene.audio[0] ?? null;
  const amb = scene.ambientKey ? bundle.ambience[scene.ambientKey] : undefined;
  const ambience = amb && (!kids || amb.kidsOk) ? amb : undefined;
  const ambientCap = kids ? KIDS_AMBIENT_MAX : AMBIENT_MAX;
  const audioMode = prefs.mode !== "read";

  /* ---------- preferences and progress ---------- */
  useEffect(() => {
    if (preview || session.status === "loading") return;
    let live = true;
    void (async () => {
      const p = await store.loadPrefs();
      if (!live) return;
      if (p) setPrefs((cur) => ({ ...p, language: bundle.scripts.some((s) => s.language === p.language) ? p.language : cur.language }));
      loaded.current = true;
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, preview]);

  useEffect(() => {
    if (preview || session.status === "loading") return;
    let live = true;
    void store.loadProgress(script.id).then((p) => {
      if (!live || !p) return;
      const i = scenes.findIndex((s) => s.id === p.sceneId);
      if (i > 0) {
        setIndex(i);
        setNotice(t.resumed(i + 1));
      }
      if (i >= 0 && p.positionMs > 0) resumeAt.current = p.positionMs;
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.id, session.status, preview]);

  const update = useCallback(
    (patch: Partial<PlaybackPrefs>) => {
      setPrefs((cur) => {
        const next = sanitizePrefs({ ...cur, ...patch });
        if (!preview && session.status !== "loading") void store.savePrefs(next);
        return next;
      });
    },
    [preview, session.status, store],
  );

  const saveProgress = useCallback(
    (sceneId: string, positionMs: number) => {
      if (preview || session.status === "loading") return;
      lastSave.current = Date.now();
      void store.saveProgress({ scriptId: script.id, sceneId, positionMs: Math.max(0, Math.round(positionMs)) });
    },
    [preview, session.status, store, script.id],
  );

  /* ---------- sound ---------- */
  const applyGains = useCallback(
    (narrating: boolean) => {
      const a = ambientGain({ volume: prefs.ambientVolume, on: prefs.ambientOn && Boolean(ambience), narrating, kids });
      const n = narrationGain(prefs.narrationVolume);
      if (graph.current) {
        graph.current.setNarration(n);
        graph.current.setAmbient(a);
      } else {
        if (nRef.current) nRef.current.volume = n;
        if (aRef.current) aRef.current.volume = a;
      }
      const amEl = aRef.current;
      if (amEl && ambience && prefs.ambientOn && narrating && amEl.paused) void amEl.play().catch(() => undefined);
      if (amEl && (!prefs.ambientOn || !ambience)) amEl.pause();
    },
    [prefs.ambientVolume, prefs.ambientOn, prefs.narrationVolume, ambience, kids],
  );

  useEffect(() => {
    applyGains(playing);
  }, [applyGains, playing]);

  useEffect(() => {
    if (nRef.current) nRef.current.playbackRate = prefs.speed;
  }, [prefs.speed, track?.url]);

  // A new scene or voice: load its file, and keep going only if the reader was already listening.
  useEffect(() => {
    const el = nRef.current;
    setTimeMs(0);
    if (!el) return;
    el.load();
    el.playbackRate = prefs.speed;
    if (continueAfterLoad.current && track) {
      continueAfterLoad.current = false;
      void el.play().catch(() => setPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.url]);

  useEffect(() => () => graph.current?.close(), []);

  async function play() {
    const el = nRef.current;
    if (!el || !track) return;
    if (!graph.current && aRef.current) {
      try {
        graph.current = new PlayerAudioGraph(el, aRef.current);
      } catch {
        graph.current = null; // no Web Audio: element volumes carry the same gains
      }
    }
    await graph.current?.resume().catch(() => undefined);
    if (resumeAt.current !== null) {
      el.currentTime = resumeAt.current / 1000;
      resumeAt.current = null;
    }
    el.playbackRate = prefs.speed;
    applyGains(true);
    await el.play().catch(() => setPlaying(false));
  }

  function pause() {
    nRef.current?.pause();
    aRef.current?.pause();
  }

  function go(i: number, keepPlaying = playing) {
    if (i < 0 || i >= scenes.length) return;
    saveProgress(scenes[i]!.id, 0);
    continueAfterLoad.current = keepPlaying && audioMode;
    if (i === index && nRef.current) {
      nRef.current.currentTime = 0;
      if (continueAfterLoad.current) void nRef.current.play().catch(() => undefined);
      continueAfterLoad.current = false;
    }
    setIndex(i);
    setNotice(null);
  }

  function replay() {
    const el = nRef.current;
    if (prefs.mode === "read" || !el || !track) return;
    el.currentTime = 0;
    if (el.paused) void play();
  }

  const cue = prefs.subtitles && audioMode ? cueAt(scene.cues, timeMs) : null;
  const textDir = RTL.has(script.language) ? "rtl" : "ltr";
  const isDraft = script.status !== "published";

  const panel = <EvidencePanel scenes={scenes} index={index} onJump={(i) => go(i)} t={t} />;

  return (
    <div className={`qp${kids ? " qp-kids" : ""}${reduceMotion ? " qp-still" : ""}`} dir={dir} data-mode={prefs.mode}>
      <div className="qp-main">
        <div className="qp-bar">
          <div className="qp-modes" role="group" aria-label={t.modes}>
            {PLAYER_MODES.map((m: PlayerMode) => (
              <button
                key={m}
                type="button"
                className="qp-mode"
                aria-pressed={prefs.mode === m}
                onClick={() => {
                  if (m === "read") pause();
                  update({ mode: m });
                }}
              >
                {t[m]}
              </button>
            ))}
          </div>
          {kids ? <span className="zq-meta qp-kids-tag">{t.kids}</span> : null}
          {isDraft ? <span className="zq-soon">{script.origin === "ai_assisted" ? t.aiDraft : t.draft}</span> : null}
        </div>

        {audioMode && !scriptHasAudio ? (
          <p className="qp-noaudio" role="status">
            {audioScripts.length ? t.noAudioLang : t.noAudio}
          </p>
        ) : null}
        {notice ? (
          <p className="zq-meta" role="status">
            {notice}
          </p>
        ) : null}

        <article className="qp-scene" aria-labelledby={`qp-h-${scene.id}`}>
          <p className="qp-kicker">
            <span>{t.sceneOf(index + 1, scenes.length)}</span>
            <span aria-hidden="true"> · </span>
            <span>{t.kinds[scene.kind]}</span>
            {scene.stepRole ? (
              <>
                <span aria-hidden="true"> · </span>
                <span>{t.roles[scene.stepRole]}</span>
              </>
            ) : null}
          </p>
          <h3 id={`qp-h-${scene.id}`} className="qp-title" lang={script.language} dir={textDir}>
            {scene.title}
          </h3>

          {prefs.mode === "immersive" && scene.animationKey ? (
            reduceMotion ? (
              <p className="zq-meta">{t.reducedMotion}</p>
            ) : (
              <AnimationPlayer key={scene.id} animation={scene.animationKey} caption={scene.title} alt={ANIMATION_LABELS[scene.animationKey] ?? scene.title} gentle={kids} />
            )
          ) : null}

          {audioMode && scriptHasAudio ? (
            <div className="qp-captions" data-testid="captions" aria-label={t.captions} hidden={!prefs.subtitles}>
              <p lang={script.language} dir={textDir}>
                {cue?.text ?? " "}
              </p>
            </div>
          ) : null}

          {prefs.mode !== "immersive" || !scriptHasAudio ? (
            <div className="qp-text" lang={script.language} dir={textDir}>
              {scene.text.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : null}

          {prefs.showRefs ? (
            <div className="qp-inline-refs">
              <ClaimRefs claims={scene.claims} t={t} />
            </div>
          ) : null}
        </article>

        <div className="qp-transport" role="group" aria-label={t.settings}>
          <button type="button" className="zq-btn zq-btn-secondary qp-btn" onClick={() => go(index - 1)} disabled={index === 0}>
            {t.previous}
          </button>
          {audioMode && scriptHasAudio ? (
            <>
              <button
                type="button"
                className="zq-btn zq-btn-primary qp-btn"
                onClick={() => (playing ? pause() : void play())}
                disabled={!track}
              >
                {playing ? t.pause : t.play}
              </button>
              <button type="button" className="zq-btn zq-btn-secondary qp-btn" onClick={replay} disabled={!track}>
                {t.replay}
              </button>
            </>
          ) : null}
          <button type="button" className="zq-btn zq-btn-secondary qp-btn" onClick={() => go(index + 1)} disabled={index >= scenes.length - 1}>
            {t.next}
          </button>
          <button type="button" className="zq-btn zq-btn-quiet qp-btn qp-sheet-open" onClick={() => setSheet(true)} aria-haspopup="dialog" aria-expanded={sheet}>
            {t.openEvidence}
          </button>
        </div>
        {audioMode && scriptHasAudio && !track ? <p className="zq-meta">{t.noAudioScene}</p> : null}

        <fieldset className="qp-settings">
          <legend>{t.settings}</legend>
          {languages.length ? (
            <label className="qp-field">
              <span>{t.language}</span>
              <select value={script.language} onChange={(e) => {
                  pause();
                  update({ language: e.target.value });
                  setIndex(0);
                }}>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {t.languages[l as keyof typeof t.languages] ?? l}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {audioMode && scriptHasAudio ? (
            <>
              <label className="qp-field">
                <span>{t.voice}</span>
                <select value={voiceId ?? ""} onChange={(e) => update({ voiceId: e.target.value })} disabled={voices.length < 2}>
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="qp-field">
                <span>{t.speed}</span>
                <select value={String(prefs.speed)} onChange={(e) => update({ speed: Number(e.target.value) })}>
                  {SPEEDS.map((s) => (
                    <option key={s} value={String(s)}>
                      {`${s}×`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="qp-field">
                <span>{t.narrationVolume}</span>
                <input type="range" min={0} max={1} step={0.05} value={prefs.narrationVolume} onChange={(e) => update({ narrationVolume: Number(e.target.value) })} />
              </label>
              <label className="qp-check">
                <input type="checkbox" checked={prefs.ambientOn} onChange={(e) => update({ ambientOn: e.target.checked })} disabled={!ambience} />
                <span>{t.ambience}</span>
              </label>
              <label className="qp-field">
                <span>{t.ambienceVolume}</span>
                <input
                  type="range"
                  min={0}
                  max={ambientCap}
                  step={0.01}
                  value={Math.min(prefs.ambientVolume, ambientCap)}
                  onChange={(e) => update({ ambientVolume: Number(e.target.value) })}
                  disabled={!prefs.ambientOn || !ambience}
                />
              </label>
              <label className="qp-check">
                <input type="checkbox" checked={prefs.subtitles} onChange={(e) => update({ subtitles: e.target.checked })} />
                <span>{t.subtitles}</span>
              </label>
            </>
          ) : null}
          <label className="qp-check">
            <input type="checkbox" checked={prefs.showRefs} onChange={(e) => update({ showRefs: e.target.checked })} />
            <span>{t.showRefs}</span>
          </label>
          {ambience && audioMode ? <p className="zq-meta qp-ambnote">{ambience.note || t.ambienceNote}</p> : null}
        </fieldset>
        <p className="zq-meta">{t.reviewed}</p>

        {/* No autoplay attribute and no src fetch before Play (preload none). */}
        <audio
          ref={nRef}
          src={audioMode && track ? track.url : undefined}
          preload="none"
          crossOrigin="anonymous"
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            aRef.current?.pause();
            if (nRef.current) saveProgress(scene.id, nRef.current.currentTime * 1000);
          }}
          onTimeUpdate={(e) => {
            const ms = e.currentTarget.currentTime * 1000;
            setTimeMs(ms);
            if (Date.now() - lastSave.current > SAVE_EVERY_MS) saveProgress(scene.id, ms);
          }}
          onEnded={() => {
            setPlaying(false);
            if (index < scenes.length - 1) go(index + 1, true);
            else saveProgress(scene.id, 0);
          }}
        />
        <audio ref={aRef} src={audioMode && ambience ? ambience.url : undefined} preload="none" loop crossOrigin="anonymous" />
      </div>

      <aside className="qp-side" aria-label={t.evidence}>
        {panel}
      </aside>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={t.evidence} closeLabel={t.close}>
        {panel}
      </BottomSheet>
    </div>
  );
}
