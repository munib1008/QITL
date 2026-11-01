"use client";

import { LoadErrorText } from "../feedback";
import { useState } from "react";
import { Skeleton } from "@/components/ui/misc";
import { getPlayerStrings } from "@/lib/i18n/modules/player";
import { AUDIO_BUCKET } from "@/lib/player/map";
import { AMBIENT_MAX } from "@/lib/player/audio";
import { Feedback, Field, Panel, call, sb, useAction, useRows } from "./shared";

interface AudioRow {
  id: string;
  status: string;
  pronunciation_ok: boolean | null;
  storage_path: string;
  duration_ms: number;
  scene_version: number;
  narration_voices: { label: string; language: string } | null;
  story_scenes: { title: string; version: number; narration_text: string } | null;
}

/** Listen to a pending file through a short-lived signed URL; nothing loads until the producer asks. */
function Listen({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  if (url) return <audio controls preload="none" src={url} />;
  return (
    <button
      type="button"
      className="zq-btn zq-btn-quiet zq-btn-sm"
      onClick={async () => {
        const r = await sb()?.storage.from(AUDIO_BUCKET).createSignedUrl(path, 600);
        if (r?.data?.signedUrl) setUrl(r.data.signedUrl);
      }}
    >
      ▶ {path.split("/").at(-1)}
    </button>
  );
}

function QaItem({ a, s, onChange }: { a: AudioRow; s: ReturnType<typeof getPlayerStrings>["studio"]; onChange: () => void }) {
  const act = useAction();
  const outdated = a.story_scenes && a.story_scenes.version !== a.scene_version;
  const post = (body: Record<string, unknown>, ok: string) => act.run(() => call("/api/admin/studio/audio", "POST", { audioId: a.id, ...body }), ok, onChange);
  return (
    <li className="pp-card st-script">
      <h3 className="st-h3" dir="auto">
        {a.story_scenes?.title ?? a.id}
      </h3>
      <p className="zq-meta">{`${a.narration_voices?.label ?? ""} (${a.narration_voices?.language ?? ""}) · ${Math.round(a.duration_ms / 1000)} s · ${s.status}: ${a.status}${outdated ? " · outdated" : ""}`}</p>
      {a.story_scenes ? (
        <details>
          <summary>{s.narration}</summary>
          <p dir="auto" className="st-text">
            {a.story_scenes.narration_text}
          </p>
        </details>
      ) : null}
      <Listen path={a.storage_path} />
      <div className="st-row">
        <label className="st-check">
          <input type="checkbox" checked={a.pronunciation_ok === true} disabled={act.busy} onChange={(e) => void post({ action: "pronunciation", ok: e.target.checked }, e.target.checked ? s.pronunciationOk : s.pronunciationBad)} />
          <span>{s.pronunciationOk}</span>
        </label>
        <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" disabled={act.busy || a.pronunciation_ok !== true || Boolean(outdated)} onClick={() => void post({ action: "approve" }, s.approve)}>
          {s.approve}
        </button>
        <button type="button" className="zq-btn zq-btn-danger zq-btn-sm" disabled={act.busy} onClick={() => void post({ action: "reject" }, s.reject)}>
          {s.reject}
        </button>
      </div>
      <Feedback msg={act.msg} />
    </li>
  );
}

function AmbienceRegistry({ s }: { s: ReturnType<typeof getPlayerStrings>["studio"] }) {
  const list = useRows<{ key: string; label: string; storage_path: string; default_gain: number; kids_ok: boolean; approved_by: string | null }>(
    () => sb()?.from("scene_ambient_audio").select("key, label, storage_path, default_gain, kids_ok, approved_by").order("key") ?? null,
  );
  const sources = useRows<{ id: string; work: string; rights_status: string }>(() => sb()?.from("sources").select("id, work, rights_status").order("work").limit(300) ?? null);
  const [f, setF] = useState({ key: "", label: "", storagePath: "", licenceSourceId: "", defaultGain: 0.15, kidsOk: true });
  const act = useAction();
  return (
    <>
      {!list.rows ? (
        <Skeleton height={20} />
      ) : (
        <ul className="st-list">
          {list.rows.map((r) => (
            <li key={r.key} className="st-row st-between">
              <span>{`${r.key} · ${r.label} · ${s.gainWord} ${r.default_gain}${r.kids_ok ? ` · ${s.kidsWord}` : ""}`}</span>
              {r.approved_by ? (
                <span className="zq-meta">{s.approvedWord}</span>
              ) : (
                <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={act.busy} onClick={() => void act.run(() => call("/api/admin/studio/ambience", "POST", { action: "approve", key: r.key }), s.approveAmbience, list.reload)}>
                  {s.approveAmbience}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="zq-form st-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act.run(() => call("/api/admin/studio/ambience", "POST", { action: "register", ...f }), s.register, list.reload);
        }}
      >
        <div className="st-row">
          <Field label={s.ambienceKey}>
            <input className="zq-input" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} pattern="[a-z0-9-]{2,40}" required />
          </Field>
          <Field label={s.ambienceLabel}>
            <input className="zq-input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} required maxLength={120} />
          </Field>
          <Field label={s.storagePath}>
            <input className="zq-input" value={f.storagePath} onChange={(e) => setF({ ...f, storagePath: e.target.value })} required maxLength={300} />
          </Field>
          <Field label={s.licence}>
            <select className="zq-input" value={f.licenceSourceId} onChange={(e) => setF({ ...f, licenceSourceId: e.target.value })} required>
              <option value="">{s.pick}</option>
              {(sources.rows ?? []).map((x) => (
                <option key={x.id} value={x.id}>{`${x.work} (${x.rights_status})`}</option>
              ))}
            </select>
          </Field>
          <Field label={s.defaultGain}>
            <input className="zq-input" type="number" min={0} max={AMBIENT_MAX} step={0.01} value={f.defaultGain} onChange={(e) => setF({ ...f, defaultGain: Math.min(AMBIENT_MAX, Number(e.target.value)) })} />
          </Field>
        </div>
        <label className="st-check">
          <input type="checkbox" checked={f.kidsOk} onChange={(e) => setF({ ...f, kidsOk: e.target.checked })} />
          <span>{s.kidsOk}</span>
        </label>
        <button type="submit" className="zq-btn zq-btn-primary" disabled={act.busy}>
          {s.register}
        </button>
        <Feedback msg={act.msg} />
      </form>
    </>
  );
}

/** Audio QA (pronunciation check, approve or reject) and the ambience registry. Audio producers only. */
export function AudioDesk({ locale }: { locale: string }) {
  const s = getPlayerStrings(locale).studio;
  const pending = useRows<AudioRow>(
    () =>
      sb()
        ?.from("narration_audio")
        .select("id, status, pronunciation_ok, storage_path, duration_ms, scene_version, narration_voices(label, language), story_scenes(title, version, narration_text)")
        .eq("status", "pending_qa")
        .order("created_at")
        .limit(100) ?? null,
  );
  return (
    <>
      <Panel title={s.audioQa} id="st-qa">
        {pending.error ? <p className="zq-error"><LoadErrorText error={pending.error} /></p> : null}
        {!pending.rows ? (
          <Skeleton height={20} />
        ) : pending.rows.length ? (
          <ul className="st-list">
            {pending.rows.map((a) => (
              <QaItem key={a.id} a={a} s={s} onChange={() => void pending.reload()} />
            ))}
          </ul>
        ) : (
          <p className="zq-meta">{s.noAudio}</p>
        )}
      </Panel>
      <Panel title={s.ambienceRegistry} id="st-amb">
        <AmbienceRegistry s={s} />
      </Panel>
    </>
  );
}
