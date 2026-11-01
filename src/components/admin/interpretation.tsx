"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { CHECKS, canSign, checkStatus, type ReviewRecord } from "@/lib/interpretation/checks";
import { DIFFERENCE_KINDS } from "@/lib/interpretation/state";
import { useLocale } from "@/lib/i18n/useLocale";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { adminInterpretationStrings } from "@/lib/i18n/modules/adminInterpretation";
import { AdminFeedback as Feedback, errMsg, type AdminMsg } from "./feedback";
import type { CheckKey, DifferenceKind } from "@/lib/interpretation/types";

/* Editorial tools for the Interpretation Explorer. Every write is authorised again by RLS and triggers. */

type Msg = AdminMsg;
const NC = "Not configured";
const sb = () => getBrowserSupabase();

function Field({ id, label, children, help }: { id: string; label: string; children: ReactNode; help?: string }) {
  return (
    <div className="zq-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {help ? <span className="zq-help">{help}</span> : null}
    </div>
  );
}

async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string, setMsg: (m: Msg) => void, after?: () => unknown) {
  setMsg(null);
  const { error } = await fn();
  if (error) setMsg({ tone: "err", text: error.message });
  else {
    setMsg({ tone: "ok", text: ok });
    await after?.();
  }
}

const fd = (e: FormEvent<HTMLFormElement>) => new FormData(e.currentTarget);
const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v || null;
};

/* ---------- Translation edition registry ---------- */

interface EditionRow {
  id: string;
  kind: string;
  language: string;
  title: string;
  publication_year: number | null;
  edition: string | null;
  origin: string;
  origin_ref: string | null;
  registry_status: "candidate" | "verified" | "rejected";
  reliability_note: string | null;
  verified_at: string | null;
  translator_profiles: { name: string } | null;
  sources: { work: string; rights_status: string } | null;
}

const KINDS = ["quran_translation", "tafsir", "early_tafsir", "hadith_translation", "hadith_commentary"] as const;
const ORIGINS = ["qurancomplex", "quran_foundation", "quranenc", "tanzil", "sunnah_com", "publisher", "other"] as const;

export function EditionRegistry({ canEdit }: { canEdit: boolean }) {
  const locale = useLocale();
  const t = useMemo(() => adminInterpretationStrings(locale), [locale]);
  const [rows, setRows] = useState<EditionRow[] | null>(null);
  const [translators, setTranslators] = useState<Array<{ id: string; name: string }>>([]);
  const [sources, setSources] = useState<Array<{ id: string; work: string; rights_status: string }>>([]);
  const [msg, setMsgState] = useState<Msg>(null);
  const setMsg = useCallback((m: Msg) => setMsgState(m && m.tone === "err" && !m.server ? errMsg(locale, t.failedPrefix, m.text, t.notConfigured) : m), [locale, t]);
  const [kind, setKind] = useState<string>("quran_translation");

  const load = useCallback(async () => {
    const c = sb();
    if (!c) return setMsg({ tone: "err", text: NC });
    const [e, t, s] = await Promise.all([
      c.from("translation_editions").select("id, kind, language, title, publication_year, edition, origin, origin_ref, registry_status, reliability_note, verified_at, translator_profiles(name), sources(work, rights_status)").order("kind").order("position", { nullsFirst: false }).limit(500),
      c.from("translator_profiles").select("id, name").order("name").limit(500),
      c.from("sources").select("id, work, rights_status").in("type", ["quran_translation", "tafsir", "hadith_translation", "hadith_collection", "other"]).order("work").limit(500),
    ]);
    if (e.error) setMsg({ tone: "err", text: e.error.message });
    setRows((e.data ?? []) as unknown as EditionRow[]);
    setTranslators((t.data ?? []) as Array<{ id: string; name: string }>);
    setSources((s.data ?? []) as Array<{ id: string; work: string; rights_status: string }>);
  }, [setMsg]);
  useEffect(() => {
    void load();
  }, [load]);

  const verify = async (r: EditionRow, status: "verified" | "rejected" | "candidate") => {
    const c = sb();
    if (!c) return;
    const { data } = await c.auth.getUser();
    const uid = data.user?.id ?? null;
    await run(
      () =>
        c
          .from("translation_editions")
          .update(status === "verified" ? { registry_status: "verified", verified_by: uid, verified_at: new Date().toISOString() } : { registry_status: status, verified_by: null, verified_at: null })
          .eq("id", r.id),
      status === "verified" ? t.okVerified(r.title) : t.okNowState(r.title, t.registryStates[status] ?? status),
      setMsg,
      load,
    );
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <Feedback msg={msg} />
      {!rows ? (
        <Skeleton height={20} />
      ) : !rows.length ? (
        <EmptyState title={t.noEditions}>
          <p>{t.noEditionsBody}</p>
        </EmptyState>
      ) : (
        <div className="zq-table-scroll">
          <table className="zq-table">
            <caption className="sr-only">{t.registeredEditions}</caption>
            <thead>
              <tr>
                <th scope="col">{t.edition}</th>
                <th scope="col">{t.kind}</th>
                <th scope="col">{t.translatorScholar}</th>
                <th scope="col">{t.year}</th>
                <th scope="col">{t.origin}</th>
                <th scope="col">{t.licence}</th>
                <th scope="col">{t.registry}</th>
                {canEdit ? <th scope="col">{t.actions}</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.title}</b>
                    {r.edition ? <div className="zq-meta">{r.edition}</div> : null}
                    {r.reliability_note ? <div className="zq-meta">{t.reliabilityLabel} {r.reliability_note}</div> : null}
                  </td>
                  <td>{t.editionKinds[r.kind] ?? r.kind.replace(/_/g, " ")}</td>
                  <td>{r.translator_profiles?.name ?? <span className="zq-licence-pending">{t.notRecorded}</span>}</td>
                  <td>{r.publication_year ?? "—"}</td>
                  <td>
                    {r.origin}
                    {r.origin_ref ? <div className="zq-meta">{r.origin_ref}</div> : null}
                  </td>
                  <td>{r.sources ? `${r.sources.work} · ${t.rightsValues[r.sources.rights_status] ?? r.sources.rights_status.replace("_", " ")}` : <span className="zq-licence-pending">{t.noSource}</span>}</td>
                  <td>{t.registryStates[r.registry_status] ?? r.registry_status}</td>
                  {canEdit ? (
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {r.registry_status !== "verified" ? (
                          <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={!r.sources || !r.translator_profiles} title={!r.sources ? t.linkSourceFirst : undefined} onClick={() => verify(r, "verified")}>
                            {t.verifyEdition}
                          </button>
                        ) : (
                          <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => verify(r, "candidate")}>
                            {t.returnCandidate}
                          </button>
                        )}
                        {r.registry_status !== "rejected" ? (
                          <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => verify(r, "rejected")}>
                            {t.reject}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit ? (
        <>
          <form
            className="pp-card zq-form"
            aria-labelledby="tp-h"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = fd(e);
              const form = e.currentTarget;
              await run(() => sb()!.from("translator_profiles").insert({ name: str(f, "name"), name_ar: str(f, "name_ar"), died: str(f, "died"), description: str(f, "description") }), t.okProfile, setMsg, async () => {
                form.reset();
                await load();
              });
            }}
          >
            <h2 id="tp-h">{t.addTranslator}</h2>
            <Field id="tp-name" label={t.namePrinted}>
              <input id="tp-name" name="name" className="zq-input" required minLength={2} />
            </Field>
            <Field id="tp-name-ar" label={t.nameArOptional}>
              <input id="tp-name-ar" name="name_ar" className="zq-input" lang="ar" dir="rtl" />
            </Field>
            <Field id="tp-died" label={t.diedPrinted} help={t.diedHelp}>
              <input id="tp-died" name="died" className="zq-input" />
            </Field>
            <Field id="tp-desc" label={t.descriptionOptional}>
              <input id="tp-desc" name="description" className="zq-input" />
            </Field>
            <button type="submit" className="zq-btn zq-btn-primary">
              {t.addProfile}
            </button>
          </form>

          <form
            className="pp-card zq-form"
            aria-labelledby="ed-h"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = fd(e);
              const form = e.currentTarget;
              const year = str(f, "publication_year");
              await run(
                () =>
                  sb()!
                    .from("translation_editions")
                    .insert({
                      kind: str(f, "kind"),
                      language: str(f, "language"),
                      title: str(f, "title"),
                      title_ar: str(f, "title_ar"),
                      translator_id: str(f, "translator_id"),
                      publication_year: year ? Number(year) : null,
                      edition: str(f, "edition"),
                      origin: str(f, "origin"),
                      origin_ref: str(f, "origin_ref"),
                      source_id: str(f, "source_id"),
                      historical_period: str(f, "historical_period"),
                      reliability_note: str(f, "reliability_note"),
                      position: str(f, "position") ? Number(str(f, "position")) : null,
                    }),
                t.okEditionRegistered,
                setMsg,
                async () => {
                  form.reset();
                  await load();
                },
              );
            }}
          >
            <h2 id="ed-h">{t.registerEdition}</h2>
            <Field id="ed-kind" label={t.kind}>
              <select id="ed-kind" name="kind" className="zq-input" value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t.editionKinds[k] ?? k.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ed-title" label={t.title}>
              <input id="ed-title" name="title" className="zq-input" required />
            </Field>
            <Field id="ed-title-ar" label={t.titleArOptional}>
              <input id="ed-title-ar" name="title_ar" className="zq-input" lang="ar" dir="rtl" />
            </Field>
            <Field id="ed-lang" label={t.language} help={t.languageHelp}>
              <input id="ed-lang" name="language" className="zq-input" required pattern="[a-z]{2}(-[A-Za-z]{2,4})?" />
            </Field>
            <Field id="ed-tr" label={t.translatorScholar}>
              <select id="ed-tr" name="translator_id" className="zq-input">
                <option value="">{t.notRecordedYet}</option>
                {translators.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ed-year" label={t.pubYearOptional}>
              <input id="ed-year" name="publication_year" className="zq-input" inputMode="numeric" pattern="[0-9]{3,4}" />
            </Field>
            <Field id="ed-edition" label={t.editionStatement}>
              <input id="ed-edition" name="edition" className="zq-input" />
            </Field>
            <Field id="ed-origin" label={t.origin}>
              <select id="ed-origin" name="origin" className="zq-input" defaultValue="publisher">
                {ORIGINS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ed-ref" label={t.providerRef} help={t.providerHelp}>
              <input id="ed-ref" name="origin_ref" className="zq-input" />
            </Field>
            <Field id="ed-src" label={t.sourceLicence} help={t.sourceLicenceHelp}>
              <select id="ed-src" name="source_id" className="zq-input">
                <option value="">{t.noneYet}</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.work} · {t.rightsValues[s.rights_status] ?? s.rights_status.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ed-period" label={t.historicalPeriod}>
              <input id="ed-period" name="historical_period" className="zq-input" />
            </Field>
            <Field id="ed-rel" label={kind === "early_tafsir" ? t.reliabilityRequired : t.reliabilityOptional}>
              <textarea id="ed-rel" name="reliability_note" className="zq-input" rows={2} required={kind === "early_tafsir"} />
            </Field>
            <Field id="ed-pos" label={t.displayPosition}>
              <input id="ed-pos" name="position" className="zq-input" inputMode="numeric" pattern="[0-9]{1,3}" />
            </Field>
            <button type="submit" className="zq-btn zq-btn-primary">
              {t.registerBtn}
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}

/* ---------- Explanation editor, eight signed checks, differences ---------- */

interface Explanation {
  id: string;
  surah_id: number | null;
  ayah_from: number | null;
  ayah_to: number | null;
  language: string;
  title: string;
  body_md: string;
  origin: "human" | "ai_assisted";
  model: string | null;
  prompt_version: string | null;
  version: number;
  status: EditorialState;
  updated_at: string;
}
interface Difference {
  id: string;
  kind: DifferenceKind;
  term_ar: string | null;
  ayah_no: number | null;
  word_no: number | null;
  summary: string;
  recognised_disagreement: boolean;
  position: number;
}

export function ExplanationEditor({ roles }: { roles: string[] }) {
  const locale = useLocale();
  const t = useMemo(() => adminInterpretationStrings(locale), [locale]);
  const statusWord = (s: string) => (uiStrings(locale).status as Record<string, string>)[s] ?? s.replace("_", " ");
  const checkLabel = (key: string, fallback: string) => t.checks[key]?.split("|")[0] ?? fallback;
  const isEditor = roles.includes("editor") || roles.includes("admin");
  const isScholar = roles.includes("scholarly_reviewer") || roles.includes("admin");
  const [list, setList] = useState<Explanation[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [diffs, setDiffs] = useState<Difference[]>([]);
  const [msg, setMsgState] = useState<Msg>(null);
  const setMsg = useCallback((m: Msg) => setMsgState(m && m.tone === "err" && !m.server ? errMsg(locale, t.failedPrefix, m.text, t.notConfigured) : m), [locale, t]);
  const current = list?.find((e) => e.id === sel) ?? null;

  const load = useCallback(async () => {
    const c = sb();
    if (!c) return setMsg({ tone: "err", text: NC });
    const { data, error } = await c.from("interpretation_explanations").select("id, surah_id, ayah_from, ayah_to, language, title, body_md, origin, model, prompt_version, version, status, updated_at").order("updated_at", { ascending: false }).limit(200);
    if (error) setMsg({ tone: "err", text: error.message });
    setList((data ?? []) as Explanation[]);
  }, [setMsg]);
  const loadDetail = useCallback(async (id: string) => {
    const c = sb();
    if (!c) return;
    const [r, d] = await Promise.all([
      c.from("interpretation_reviews").select("check_key, passed, explanation_version, reviewer_id, note, created_at").eq("explanation_id", id).order("created_at", { ascending: false }),
      c.from("interpretation_differences").select("id, kind, term_ar, ayah_no, word_no, summary, recognised_disagreement, position").eq("explanation_id", id).order("position"),
    ]);
    setReviews((r.data ?? []) as ReviewRecord[]);
    setDiffs((d.data ?? []) as Difference[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (sel) void loadDetail(sel);
  }, [sel, loadDetail]);

  const refresh = async () => {
    await load();
    if (sel) await loadDetail(sel);
  };

  const sign = async (key: CheckKey, passed: boolean, note: string) => {
    const c = sb();
    if (!c || !current) return;
    const { data } = await c.auth.getUser();
    await run(
      () => c.from("interpretation_reviews").insert({ explanation_id: current.id, explanation_version: current.version, check_key: key, passed, reviewer_id: data.user?.id, note: note || null }),
      t.okSigned(passed, checkLabel(key, CHECKS.find((x) => x.key === key)?.label ?? key), current.version),
      setMsg,
      refresh,
    );
  };

  const setStatus = async (status: EditorialState) => {
    if (!current) return;
    await run(() => sb()!.from("interpretation_explanations").update({ status }).eq("id", current.id), t.okStatusSet(statusWord(status)), setMsg, refresh);
  };

  const approve = async () => {
    if (!current) return;
    setMsg(null);
    const r = await fetch("/api/admin/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType: "interpretation", entityId: current.id, decision: "approved" }) });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    setMsg(r.ok ? { tone: "ok", text: t.okApproval } : { tone: "err", text: d.error ?? `Failed (${r.status})` });
  };

  const aiDraft = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = fd(e);
    setMsg(null);
    const r = await fetch("/api/admin/interpretation/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surah: Number(f.get("surah")), ayahFrom: Number(f.get("from")), ayahTo: Number(f.get("to")), language: f.get("language") }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string; id?: string };
    if (r.ok && d.id) {
      setMsg({ tone: "ok", text: t.okAiDraft });
      await load();
      setSel(d.id);
    } else setMsg({ tone: "err", text: d.error ?? `Failed (${r.status})` });
  };

  const status = current ? checkStatus(reviews, current.version) : [];

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <Feedback msg={msg} />
      <section className="pp-card" aria-labelledby="ex-list-h">
        <h2 id="ex-list-h">{t.explanations}</h2>
        {!list ? (
          <Skeleton height={20} />
        ) : !list.length ? (
          <EmptyState title={t.noExplanations} />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {list.map((e) => (
              <li key={e.id}>
                <button type="button" className="zq-btn zq-btn-quiet" aria-pressed={sel === e.id} onClick={() => setSel(e.id)} style={{ inlineSize: "100%", justifyContent: "space-between", textAlign: "start" }}>
                  <span>
                    {t.explLabel(e.surah_id ? `Q ${e.surah_id}:${e.ayah_from}${e.ayah_to !== e.ayah_from ? `–${e.ayah_to}` : ""}` : t.hadithWord, e.title, e.version, e.origin === "ai_assisted" ? t.originAi(String(e.model)) : t.originHuman())}
                  </span>
                  <EditorialStatus status={e.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isEditor ? (
        <div className="zq-grid">
          <form
            className="pp-card zq-form"
            aria-labelledby="ex-new-h"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = fd(e);
              const form = e.currentTarget;
              const c = sb();
              if (!c) return;
              const { data } = await c.auth.getUser();
              await run(
                () =>
                  c.from("interpretation_explanations").insert({
                    surah_id: Number(f.get("surah")),
                    ayah_from: Number(f.get("from")),
                    ayah_to: Number(f.get("to")),
                    language: f.get("language"),
                    title: str(f, "title"),
                    body_md: str(f, "body"),
                    origin: "human",
                    status: "draft",
                    created_by: data.user?.id,
                  }),
                t.okDraftSaved,
                setMsg,
                async () => {
                  form.reset();
                  await load();
                },
              );
            }}
          >
            <h2 id="ex-new-h">{t.newExplanation}</h2>
            <RefFields prefix="nx" />
            <Field id="nx-title" label={t.title}>
              <input id="nx-title" name="title" className="zq-input" required />
            </Field>
            <Field id="nx-body" label={t.explanationMd} help={t.explanationHelp}>
              <textarea id="nx-body" name="body" className="zq-input" rows={6} required />
            </Field>
            <button type="submit" className="zq-btn zq-btn-primary">
              {t.saveDraft}
            </button>
          </form>
          <form className="pp-card zq-form" aria-labelledby="ex-ai-h" onSubmit={aiDraft}>
            <h2 id="ex-ai-h">{t.aiDraft}</h2>
            <p className="zq-meta">{t.aiNote}</p>
            <RefFields prefix="ai" />
            <button type="submit" className="zq-btn zq-btn-secondary">
              {t.requestDraft}
            </button>
          </form>
        </div>
      ) : null}

      {current ? (
        <>
          <section className="pp-card zq-form" aria-labelledby="ex-edit-h">
            <h2 id="ex-edit-h">
              {t.editPrefix} {current.title} <EditorialStatus status={current.status} />
            </h2>
            <p className="zq-meta">
              {t.versionLine(current.version, current.origin === "ai_assisted" ? t.originAiLong(String(current.model), String(current.prompt_version)) : t.originPerson)} {t.newVersionNote}
            </p>
            {isEditor && current.status !== "published" ? (
              <form
                className="zq-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = fd(e);
                  await run(() => sb()!.from("interpretation_explanations").update({ title: str(f, "title"), body_md: str(f, "body") }).eq("id", current.id), t.okNewVersion, setMsg, refresh);
                }}
              >
                <Field id="ed-x-title" label={t.title}>
                  <input id="ed-x-title" name="title" className="zq-input" defaultValue={current.title} key={`t-${current.id}-${current.version}`} required />
                </Field>
                <Field id="ed-x-body" label={t.explanationMd}>
                  <textarea id="ed-x-body" name="body" className="zq-input" rows={8} defaultValue={current.body_md} key={`b-${current.id}-${current.version}`} required />
                </Field>
                <button type="submit" className="zq-btn zq-btn-secondary">
                  {t.saveNewVersion}
                </button>
              </form>
            ) : (
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{current.body_md}</pre>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {isEditor && current.status === "draft" ? (
                <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => setStatus("in_review")}>
                  {t.sendToReview}
                </button>
              ) : null}
              {isScholar ? (
                <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={approve}>
                  {t.recordApproval}
                </button>
              ) : null}
              {isEditor && current.status !== "published" ? (
                <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => setStatus("published")}>
                  {t.publish}
                </button>
              ) : null}
              {isEditor && current.status === "published" ? (
                <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => setStatus("correction")}>
                  {t.moveCorrection}
                </button>
              ) : null}
            </div>
          </section>

          <section className="pp-card" aria-labelledby="ex-checks-h">
            <h2 id="ex-checks-h">{t.eightChecks(current.version)}</h2>
            <p className="zq-meta">{t.checksNote}</p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {status.map((c) => (
                <CheckRow key={c.key} check={c} allowed={canSign(c.key, roles)} onSign={sign} />
              ))}
            </ol>
          </section>

          <section className="pp-card" aria-labelledby="ex-diff-h">
            <h2 id="ex-diff-h">{t.differencesExplained}</h2>
            <p className="zq-meta">{t.differencesNote}</p>
            {diffs.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {diffs.map((d) => (
                  <li key={d.id} className="zq-card" style={{ maxWidth: "none" }}>
                    <p className="zq-eyebrow">
                      {t.diffKinds[d.kind] ?? d.kind}
                      {d.recognised_disagreement ? t.recognisedDisagreement : ""}
                      {d.ayah_no ? t.ayahWord(d.ayah_no, d.word_no) : ""}
                    </p>
                    {d.term_ar ? (
                      <p lang="ar" dir="rtl" style={{ margin: 0 }}>
                        {d.term_ar}
                      </p>
                    ) : null}
                    <p style={{ margin: 0 }}>{d.summary}</p>
                    {isEditor || isScholar ? (
                      <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => run(() => sb()!.from("interpretation_differences").delete().eq("id", d.id), t.okDiffRemoved, setMsg, refresh)}>
                        {t.remove}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t.noDifferences} />
            )}
            {isEditor || isScholar ? (
              <form
                className="zq-form"
                style={{ marginBlockStart: 16 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = fd(e);
                  const form = e.currentTarget;
                  const num = (k: string) => (str(f, k) ? Number(str(f, k)) : null);
                  await run(
                    () =>
                      sb()!
                        .from("interpretation_differences")
                        .insert({
                          explanation_id: current.id,
                          kind: f.get("kind"),
                          term_ar: str(f, "term_ar"),
                          surah_id: current.surah_id,
                          ayah_no: num("ayah_no"),
                          word_no: num("word_no"),
                          summary: str(f, "summary"),
                          recognised_disagreement: f.get("recognised") === "on",
                          position: (diffs.at(-1)?.position ?? 0) + 1,
                        }),
                    t.okDiffAdded,
                    setMsg,
                    async () => {
                      form.reset();
                      await refresh();
                    },
                  );
                }}
              >
                <h3 style={{ margin: 0 }}>{t.addDifference}</h3>
                <Field id="df-kind" label={t.kind}>
                  <select id="df-kind" name="kind" className="zq-input" required>
                    {DIFFERENCE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t.diffKinds[k] ?? k}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="df-term" label={t.arabicTermOptional}>
                  <input id="df-term" name="term_ar" className="zq-input" lang="ar" dir="rtl" />
                </Field>
                <Field id="df-ayah" label={t.ayahOptional}>
                  <input id="df-ayah" name="ayah_no" className="zq-input" inputMode="numeric" pattern="[0-9]{1,3}" />
                </Field>
                <Field id="df-word" label={t.wordNumberOptional}>
                  <input id="df-word" name="word_no" className="zq-input" inputMode="numeric" pattern="[0-9]{1,3}" />
                </Field>
                <Field id="df-summary" label={t.summary}>
                  <textarea id="df-summary" name="summary" className="zq-input" rows={3} required />
                </Field>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="recognised" /> {t.recognisedCheck}
                </label>
                <button type="submit" className="zq-btn zq-btn-secondary">
                  {t.addDiffBtn}
                </button>
              </form>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function RefFields({ prefix }: { prefix: string }) {
  const t = adminInterpretationStrings(useLocale());
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Field id={`${prefix}-s`} label={t.surah}>
        <input id={`${prefix}-s`} name="surah" className="zq-input" type="number" min={1} max={114} required style={{ inlineSize: 90 }} />
      </Field>
      <Field id={`${prefix}-f`} label={t.fromAyah}>
        <input id={`${prefix}-f`} name="from" className="zq-input" type="number" min={1} max={286} required style={{ inlineSize: 90 }} />
      </Field>
      <Field id={`${prefix}-t`} label={t.toAyah}>
        <input id={`${prefix}-t`} name="to" className="zq-input" type="number" min={1} max={286} required style={{ inlineSize: 90 }} />
      </Field>
      <Field id={`${prefix}-l`} label={t.language}>
        <select id={`${prefix}-l`} name="language" className="zq-input" defaultValue="en">
          <option value="en">{t.langNames.en}</option>
          <option value="ar">{t.langNames.ar}</option>
          <option value="ur">{t.langNames.ur}</option>
        </select>
      </Field>
    </div>
  );
}

function CheckRow({ check, allowed, onSign }: { check: ReturnType<typeof checkStatus>[number]; allowed: boolean; onSign: (key: CheckKey, passed: boolean, note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const locale = useLocale();
  const t = adminInterpretationStrings(locale);
  const label = t.checkStates[check.state];
  const [cLabel, cHelp] = (t.checks[check.key] ?? "").split("|");
  return (
    <li className="zq-card" style={{ maxWidth: "none" }} data-check={check.key} data-check-state={check.state}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <b>{cLabel || check.label}</b>
        <span className={check.state === "passed" ? "zq-help" : "zq-licence-pending"}>{label}</span>
      </div>
      <p className="zq-meta" style={{ margin: 0 }}>
        {cHelp || check.help} {t.signedBy(check.roles.map((r) => t.roleNames[r] ?? r.replace("_", " ")).join(t.or))}
      </p>
      {check.latest ? (
        <p className="zq-meta" style={{ margin: 0 }}>
          {t.lastCheck(check.latest.passed, check.latest.explanation_version, new Date(check.latest.created_at).toLocaleString(), check.latest.note)}
        </p>
      ) : null}
      {allowed ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <div className="zq-field">
            <label htmlFor={`note-${check.key}`}>{t.note}</label>
            <input id={`note-${check.key}`} className="zq-input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => onSign(check.key, true, note)}>
            {t.signPass}
          </button>
          <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => onSign(check.key, false, note)}>
            {t.signFail}
          </button>
        </div>
      ) : (
        <p className="zq-meta" style={{ margin: 0 }}>
          {t.cannotSign}
        </p>
      )}
    </li>
  );
}
