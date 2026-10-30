"use client";

import "@/styles/player.css";
import { useEffect, useState } from "react";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { Skeleton } from "@/components/ui/misc";
import { StoryPlayer } from "@/components/player/StoryPlayer";
import { getPlayerStrings } from "@/lib/i18n/modules/player";
import { AMBIENCE_SELECT, AUDIO_BUCKET, SCRIPT_SELECT, audioPaths, mapAmbience, mapScript, type AmbienceRow, type ScriptRow } from "@/lib/player/map";
import { SCENE_KINDS, SCENE_STEP_ROLES, SCRIPT_AUDIENCES, SCRIPT_LANGUAGES, type PlayerBundle, type SceneKind, type SceneStepRole } from "@/lib/player/types";
import { ANIMATION_KEYS } from "@/lib/production/schemas";
import { Feedback, Field, Panel, call, sb, useAction, useRows } from "./shared";

export interface StudioFlags {
  translate: boolean;
  narrate: boolean;
  draft: boolean;
}
export interface StudioRoles {
  editor: boolean;
  reviewer: boolean;
  translator: boolean;
  audio: boolean;
}

interface Subject {
  kind: "person" | "event";
  id: string;
}
interface ScriptListRow {
  id: string;
  title: string;
  language: string;
  audience: string;
  version: number;
  status: EditorialState;
  origin: string;
  model: string | null;
  translated_from: string | null;
  story_scenes: Array<{ id: string; position: number; scene_kind: SceneKind; step_role: SceneStepRole | null; title: string; version: number; scene_claim_references: Array<{ claim_id: string }> }>;
}
interface Claim {
  id: string;
  statement: string;
  evidence: string;
}
interface SceneDraft {
  kind: SceneKind;
  stepRole: SceneStepRole | null;
  title: string;
  narrationText: string;
  lessons: string;
  animationKey: string;
  ambientKey: string;
}

const blankScenes = (): SceneDraft[] =>
  SCENE_KINDS.map((kind) => ({ kind, stepRole: kind === "sequence" ? "situation" : null, title: "", narrationText: "", lessons: "", animationKey: "", ambientKey: "" }));

/* ---------- subject ---------- */
function SubjectPicker({ value, onChange, s }: { value: Subject | null; onChange: (v: Subject | null) => void; s: ReturnType<typeof getPlayerStrings>["studio"] }) {
  const [kind, setKind] = useState<"person" | "event">(value?.kind ?? "person");
  const people = useRows<{ id: string; name_en: string }>(() => sb()?.from("people").select("id, name_en").order("name_en").limit(500) ?? null);
  const events = useRows<{ id: string; title: string }>(() => sb()?.from("historical_events").select("id, title").order("title").limit(500) ?? null);
  const list = kind === "person" ? (people.rows ?? []).map((p) => ({ id: p.id, label: p.name_en })) : (events.rows ?? []).map((e) => ({ id: e.id, label: e.title }));
  return (
    <div className="st-row">
      <Field label={s.subject}>
        <select
          className="zq-input"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as "person" | "event");
            onChange(null);
          }}
        >
          <option value="person">{s.person}</option>
          <option value="event">{s.event}</option>
        </select>
      </Field>
      <Field label={kind === "person" ? s.person : s.event}>
        <select className="zq-input" value={value?.id ?? ""} onChange={(e) => onChange(e.target.value ? { kind, id: e.target.value } : null)}>
          <option value="">{s.pick}</option>
          {list.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

/* ---------- new script ---------- */
function NewScript({ subject, ambience, onSaved, s, t }: { subject: Subject; ambience: string[]; onSaved: () => void; s: ReturnType<typeof getPlayerStrings>["studio"]; t: ReturnType<typeof getPlayerStrings>["player"] }) {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("en");
  const [audience, setAudience] = useState("full");
  const [scenes, setScenes] = useState<SceneDraft[]>(blankScenes);
  const act = useAction();
  const set = (i: number, patch: Partial<SceneDraft>) => setScenes((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <form
      className="zq-form st-form"
      onSubmit={(e) => {
        e.preventDefault();
        void act.run(
          () =>
            call("/api/admin/studio/scripts", "POST", {
              [subject.kind === "person" ? "personId" : "eventId"]: subject.id,
              title,
              language,
              audience,
              scenes: scenes.map((x) => ({
                kind: x.kind,
                stepRole: x.kind === "sequence" ? x.stepRole : null,
                title: x.title,
                narrationText: x.narrationText,
                lessons: x.lessons.split("\n").map((l) => l.trim()).filter(Boolean),
                animationKey: x.animationKey || null,
                ambientKey: x.ambientKey || null,
              })),
            }),
          s.saved,
          () => {
            setTitle("");
            setScenes(blankScenes());
            onSaved();
          },
        );
      }}
    >
      <div className="st-row">
        <Field label={s.scriptTitle}>
          <input className="zq-input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </Field>
        <Field label={s.language}>
          <select className="zq-input" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {SCRIPT_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {t.languages[l]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={s.audience}>
          <select className="zq-input" value={audience} onChange={(e) => setAudience(e.target.value)}>
            {SCRIPT_AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ol className="st-scenes">
        {scenes.map((x, i) => (
          <li key={i} className="st-scene">
            <fieldset>
              <legend>{`${i + 1}. ${t.kinds[x.kind]}`}</legend>
              <div className="st-row">
                <Field label={s.sceneKind}>
                  <select className="zq-input" value={x.kind} onChange={(e) => set(i, { kind: e.target.value as SceneKind, stepRole: e.target.value === "sequence" ? (x.stepRole ?? "situation") : null })}>
                    {SCENE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t.kinds[k]}
                      </option>
                    ))}
                  </select>
                </Field>
                {x.kind === "sequence" ? (
                  <Field label={s.stepRole}>
                    <select className="zq-input" value={x.stepRole ?? "situation"} onChange={(e) => set(i, { stepRole: e.target.value as SceneStepRole })}>
                      {SCENE_STEP_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t.roles[r]}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                <Field label={s.animation}>
                  <select className="zq-input" value={x.animationKey} onChange={(e) => set(i, { animationKey: e.target.value })}>
                    <option value="">{s.none}</option>
                    {ANIMATION_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={s.ambience}>
                  <select className="zq-input" value={x.ambientKey} onChange={(e) => set(i, { ambientKey: e.target.value })}>
                    <option value="">{s.none}</option>
                    {ambience.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label={s.sceneTitle}>
                <input className="zq-input" value={x.title} onChange={(e) => set(i, { title: e.target.value })} required maxLength={200} dir="auto" />
              </Field>
              <Field label={s.narration}>
                <textarea className="zq-textarea" rows={5} value={x.narrationText} onChange={(e) => set(i, { narrationText: e.target.value })} required maxLength={5000} dir="auto" />
              </Field>
              <Field label={s.lessons}>
                <textarea className="zq-textarea" rows={2} value={x.lessons} onChange={(e) => set(i, { lessons: e.target.value })} dir="auto" />
              </Field>
              <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => setScenes((all) => all.filter((_, j) => j !== i))} disabled={scenes.length < 2}>
                {s.removeScene}
              </button>
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="st-row">
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => setScenes((all) => [...all, { ...blankScenes()[3]! }])}>
          {s.addScene}
        </button>
        <button type="submit" className="zq-btn zq-btn-primary" disabled={act.busy}>
          {s.save}
        </button>
      </div>
      <Feedback msg={act.msg} />
    </form>
  );
}

/* ---------- Claude-assisted draft ---------- */
function AiDraft({ subject, claims, onSaved, s }: { subject: Subject; claims: Claim[]; onSaved: () => void; s: ReturnType<typeof getPlayerStrings>["studio"] }) {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("en");
  const [audience, setAudience] = useState("full");
  const [chosen, setChosen] = useState<string[]>([]);
  const act = useAction();
  return (
    <form
      className="zq-form st-form"
      onSubmit={(e) => {
        e.preventDefault();
        void act.run(
          () => call("/api/admin/studio/draft", "POST", { [subject.kind === "person" ? "personId" : "eventId"]: subject.id, title, language, audience, claimIds: chosen }),
          s.saved,
          onSaved,
        );
      }}
    >
      <p className="zq-help">{s.aiDraftHelp}</p>
      <div className="st-row">
        <Field label={s.scriptTitle}>
          <input className="zq-input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </Field>
        <Field label={s.language}>
          <select className="zq-input" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {SCRIPT_LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label={s.audience}>
          <select className="zq-input" value={audience} onChange={(e) => setAudience(e.target.value)}>
            {SCRIPT_AUDIENCES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Field>
      </div>
      <fieldset className="st-claims">
        <legend>{s.claim}</legend>
        {claims.map((c) => (
          <label key={c.id} className="st-check">
            <input type="checkbox" checked={chosen.includes(c.id)} onChange={(e) => setChosen((all) => (e.target.checked ? [...all, c.id] : all.filter((x) => x !== c.id)))} />
            <span>{c.statement}</span>
          </label>
        ))}
      </fieldset>
      <button type="submit" className="zq-btn zq-btn-primary" disabled={act.busy || !chosen.length}>
        {s.aiDraft}
      </button>
      <Feedback msg={act.msg} />
    </form>
  );
}

/* ---------- one script ---------- */
function ScriptCard({
  row,
  claims,
  voices,
  flags,
  roles,
  onChange,
  onPreview,
  s,
  t,
}: {
  row: ScriptListRow;
  claims: Claim[];
  voices: Array<{ id: string; label: string; language: string }>;
  flags: StudioFlags;
  roles: StudioRoles;
  onChange: () => void;
  onPreview: (id: string) => void;
  s: ReturnType<typeof getPlayerStrings>["studio"];
  t: ReturnType<typeof getPlayerStrings>["player"];
}) {
  const act = useAction();
  const [target, setTarget] = useState(row.language === "en" ? "ar" : "en");
  const [link, setLink] = useState<{ sceneId: string; claimId: string; anchor: string }>({ sceneId: "", claimId: "", anchor: "" });
  const [voice, setVoice] = useState(voices[0]?.id ?? "");
  const scenes = [...row.story_scenes].sort((a, b) => a.position - b.position);
  const review = (body: Record<string, unknown>, ok: string) => act.run(() => call("/api/admin/studio/review", "POST", { scriptId: row.id, ...body }), ok, onChange);
  return (
    <li className="pp-card st-script">
      <div className="st-row st-between">
        <h3 className="st-h3" dir="auto">
          {row.title}
        </h3>
        <EditorialStatus status={row.status} />
      </div>
      <p className="zq-meta">
        {`${t.languages[row.language as keyof typeof t.languages] ?? row.language} · ${row.audience} · ${s.version} ${row.version} · ${row.origin}${row.model ? ` (${row.model})` : ""}${row.translated_from ? " · translation" : ""}`}
      </p>
      <div className="st-row">
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => onPreview(row.id)}>
          {s.preview}
        </button>
        {roles.editor && row.status === "draft" ? (
          <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={act.busy} onClick={() => void review({ action: "request" }, s.reviewRequested)}>
            {s.requestReview}
          </button>
        ) : null}
        {roles.reviewer && row.status === "in_review" ? (
          <>
            <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" disabled={act.busy} onClick={() => void review({ action: "decide", decision: "approved" }, s.approve)}>
              {s.approve}
            </button>
            <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={act.busy} onClick={() => void review({ action: "decide", decision: "changes_requested" }, s.changes)}>
              {s.changes}
            </button>
            <button type="button" className="zq-btn zq-btn-danger zq-btn-sm" disabled={act.busy} onClick={() => void review({ action: "decide", decision: "rejected" }, s.reject)}>
              {s.reject}
            </button>
          </>
        ) : null}
        {roles.editor && ["in_review", "approved"].includes(row.status) ? (
          <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={act.busy} onClick={() => void review({ action: "publish" }, s.published)}>
            {s.publish}
          </button>
        ) : null}
      </div>

      {(roles.editor || roles.translator) && !row.translated_from ? (
        <div className="st-row">
          <Field label={s.targetLanguage}>
            <select className="zq-input" value={target} onChange={(e) => setTarget(e.target.value)}>
              {SCRIPT_LANGUAGES.filter((l) => l !== row.language).map((l) => (
                <option key={l} value={l}>
                  {t.languages[l]}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            className="zq-btn zq-btn-secondary zq-btn-sm"
            disabled={act.busy || !flags.translate}
            onClick={() => void act.run(() => call("/api/admin/studio/translate", "POST", { scriptId: row.id, targetLanguage: target }), s.saved, onChange)}
          >
            {s.translate}
          </button>
          {!flags.translate ? <span className="zq-soon">{s.translateNotConfigured}</span> : null}
        </div>
      ) : null}

      <details className="st-details">
        <summary>{`${s.scenes} (${scenes.length})`}</summary>
        <ol className="st-scenelist">
          {scenes.map((sc) => (
            <li key={sc.id}>
              <span className="zq-meta">{`${t.kinds[sc.scene_kind]}${sc.step_role ? ` · ${t.roles[sc.step_role]}` : ""} · ${sc.scene_claim_references.length} claim(s)`}</span>
              <span dir="auto">{sc.title}</span>
            </li>
          ))}
        </ol>
        {roles.editor ? (
          <form
            className="st-row"
            onSubmit={(e) => {
              e.preventDefault();
              void act.run(() => call("/api/admin/studio/claims", "POST", { sceneId: link.sceneId, claimId: link.claimId, anchor: link.anchor || undefined }), s.linkClaim, onChange);
            }}
          >
            <Field label={s.sceneTitle}>
              <select className="zq-input" value={link.sceneId} onChange={(e) => setLink({ ...link, sceneId: e.target.value })} required>
                <option value="">{s.pick}</option>
                {scenes.map((sc) => (
                  <option key={sc.id} value={sc.id}>{`${sc.position}. ${sc.title}`}</option>
                ))}
              </select>
            </Field>
            <Field label={s.claim}>
              <select className="zq-input" value={link.claimId} onChange={(e) => setLink({ ...link, claimId: e.target.value })} required>
                <option value="">{s.pick}</option>
                {claims.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.statement.slice(0, 90)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={s.anchor}>
              <input className="zq-input" value={link.anchor} onChange={(e) => setLink({ ...link, anchor: e.target.value })} maxLength={300} />
            </Field>
            <button type="submit" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={act.busy}>
              {s.linkClaim}
            </button>
          </form>
        ) : null}
        {roles.audio ? (
          <div className="st-row">
            <Field label={s.voice}>
              <select className="zq-input" value={voice} onChange={(e) => setVoice(e.target.value)}>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>{`${v.label} (${v.language})`}</option>
                ))}
              </select>
            </Field>
            {scenes.map((sc) => (
              <button
                key={sc.id}
                type="button"
                className="zq-btn zq-btn-quiet zq-btn-sm"
                disabled={act.busy || !flags.narrate || !voice}
                onClick={() => void act.run(() => call("/api/admin/studio/narrate", "POST", { sceneId: sc.id, voiceId: voice }), s.narrate, onChange)}
              >
                {`${s.narrate} ${sc.position}`}
              </button>
            ))}
            {!flags.narrate ? <span className="zq-soon">{s.narrateNotConfigured}</span> : null}
          </div>
        ) : null}
      </details>
      <Feedback msg={act.msg} />
    </li>
  );
}

/* ---------- stale flags ---------- */
function StaleFlags({ s }: { s: ReturnType<typeof getPlayerStrings>["studio"] }) {
  const deps = useRows<{ id: string; dependant_type: string; dependant_id: string; source_type: string; flagged_at: string | null }>(
    () => sb()?.from("content_dependency_versions").select("id, dependant_type, dependant_id, source_type, flagged_at").eq("stale", true).limit(200) ?? null,
  );
  const audio = useRows<{ id: string; scene_id: string; story_scenes: { title: string } | null }>(
    () => sb()?.from("narration_audio").select("id, scene_id, story_scenes(title)").eq("status", "stale").limit(200) ?? null,
  );
  const none = (deps.rows?.length ?? 0) + (audio.rows?.length ?? 0) === 0;
  if (!deps.rows || !audio.rows) return <Skeleton height={20} />;
  if (none) return <p className="zq-meta">{s.staleNone}</p>;
  return (
    <div className="st-stale">
      {audio.rows.length ? (
        <>
          <h3 className="st-h3">{s.staleAudio}</h3>
          <ul>
            {audio.rows.map((a) => (
              <li key={a.id} dir="auto">
                {a.story_scenes?.title ?? a.scene_id}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {deps.rows.length ? (
        <>
          <h3 className="st-h3">{s.staleDeps}</h3>
          <ul>
            {deps.rows.map((d) => (
              <li key={d.id}>{`${d.dependant_type} ${d.dependant_id.slice(0, 8)} ← ${d.source_type}${d.flagged_at ? ` (${d.flagged_at.slice(0, 10)})` : ""}`}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/* ---------- preview ---------- */
export function StudioPreview({ scriptId, locale }: { scriptId: string; locale: string }) {
  const s = getPlayerStrings(locale).studio;
  const [bundle, setBundle] = useState<PlayerBundle | null | "error">(null);
  const [frame, setFrame] = useState<"desktop" | "mobile" | "kids">("desktop");
  useEffect(() => {
    let live = true;
    const c = sb();
    if (!c) return;
    void (async () => {
      const { data, error } = await c.from("story_scripts").select(SCRIPT_SELECT).eq("id", scriptId).maybeSingle();
      if (!live) return;
      if (error || !data) return setBundle("error");
      const row = data as unknown as ScriptRow;
      const keys = [...new Set((row.story_scenes ?? []).map((x) => x.ambient_key).filter((k): k is string => Boolean(k)))];
      const amb = keys.length ? await c.from("scene_ambient_audio").select(AMBIENCE_SELECT).in("key", keys) : { data: [] };
      const ambRows = (amb.data ?? []) as AmbienceRow[];
      const paths = [...audioPaths([row]), ...ambRows.map((a) => a.storage_path)];
      const urls = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await c.storage.from(AUDIO_BUCKET).createSignedUrls(paths, 3600);
        for (const x of signed ?? []) if (x.path && x.signedUrl) urls.set(x.path, x.signedUrl);
      }
      const url = (p: string) => urls.get(p) ?? null;
      const script = mapScript(row, url);
      if (live) setBundle(script.scenes.length ? { scripts: [script], ambience: mapAmbience(ambRows, url) } : "error");
    })();
    return () => {
      live = false;
    };
  }, [scriptId]);
  if (bundle === null) return <Skeleton height={120} />;
  if (bundle === "error") return <p className="zq-error">{s.loading}</p>;
  return (
    <div className="st-preview">
      <div className="qp-modes" role="group" aria-label={s.preview}>
        {(["desktop", "mobile", "kids"] as const).map((f) => (
          <button key={f} type="button" className="qp-mode" aria-pressed={frame === f} onClick={() => setFrame(f)}>
            {s[f]}
          </button>
        ))}
      </div>
      <div className="st-frame" data-frame={frame}>
        <StoryPlayer bundle={bundle} locale={locale} kids={frame === "kids"} preview />
      </div>
    </div>
  );
}

/* ---------- the studio ---------- */
export function Studio({ locale, flags, roles }: { locale: string; flags: StudioFlags; roles: StudioRoles }) {
  const { studio: s, player: t } = getPlayerStrings(locale);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const claims = useRows<Claim>(() => sb()?.from("evidence_claims").select("id, statement, evidence").in("status", ["approved", "published"]).order("created_at", { ascending: false }).limit(300) ?? null);
  const voices = useRows<{ id: string; label: string; language: string }>(() => sb()?.from("narration_voices").select("id, label, language").eq("active", true) ?? null);
  const ambience = useRows<{ key: string }>(() => sb()?.from("scene_ambient_audio").select("key").not("approved_by", "is", null) ?? null);
  const scripts = useRows<ScriptListRow>(
    () =>
      subject
        ? (sb()
            ?.from("story_scripts")
            .select("id, title, language, audience, version, status, origin, model, translated_from, story_scenes(id, position, scene_kind, step_role, title, version, scene_claim_references(claim_id))")
            .eq(subject.kind === "person" ? "person_id" : "event_id", subject.id)
            .order("created_at", { ascending: false }) ?? null)
        : Promise.resolve({ data: [], error: null }),
    [subject?.id],
  );
  return (
    <div className="st">
      <p className="zq-meta">{s.lead}</p>
      <Panel title={s.subject} id="st-subject">
        <SubjectPicker value={subject} onChange={setSubject} s={s} />
      </Panel>
      {subject ? (
        <>
          <Panel title={s.scripts} id="st-scripts">
            {scripts.error ? <p className="zq-error">{scripts.error}</p> : null}
            {!scripts.rows ? (
              <Skeleton height={20} />
            ) : (
              <ul className="st-list">
                {scripts.rows.map((r) => (
                  <ScriptCard
                    key={r.id}
                    row={r}
                    claims={claims.rows ?? []}
                    voices={voices.rows ?? []}
                    flags={flags}
                    roles={roles}
                    onChange={() => void scripts.reload()}
                    onPreview={setPreview}
                    s={s}
                    t={t}
                  />
                ))}
              </ul>
            )}
          </Panel>
          {preview ? (
            <Panel title={s.preview} id="st-preview">
              <StudioPreview key={preview} scriptId={preview} locale={locale} />
            </Panel>
          ) : null}
          {roles.editor ? (
            <Panel title={s.newScript} id="st-new">
              <NewScript subject={subject} ambience={(ambience.rows ?? []).map((a) => a.key)} onSaved={() => void scripts.reload()} s={s} t={t} />
            </Panel>
          ) : null}
          {roles.editor && flags.draft ? (
            <Panel title={s.aiDraft} id="st-ai">
              <AiDraft subject={subject} claims={claims.rows ?? []} onSaved={() => void scripts.reload()} s={s} />
            </Panel>
          ) : null}
        </>
      ) : null}
      <Panel title={s.stale} id="st-stale">
        <StaleFlags s={s} />
      </Panel>
    </div>
  );
}
