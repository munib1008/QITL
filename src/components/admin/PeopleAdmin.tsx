"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import {
  ENCYCLOPEDIA_KINDS,
  allowedKinds,
  kindIssue,
  kindIssueText,
  personPublishHints,
  quranRefs,
  trackFor,
  type RefRow,
  type Scope,
} from "@/lib/people-admin/form";
import type { peopleAdminStrings } from "@/lib/i18n/modules/peopleAdmin";

type T = ReturnType<typeof peopleAdminStrings>;

/**
 * People and Communities editor (editors write; scholarly reviewers read and review). Every call goes to /api/admin/people/*
 * or to the shared review route; the routes and the database (RLS, publish guards, audit triggers) decide, so this screen only
 * offers what a role may try and shows the database's refusal in its own words.
 */
class ApiFail extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}
async function api<R = Record<string, unknown>>(url: string, method = "GET", body?: unknown): Promise<R> {
  const r = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = (await r.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!r.ok) throw new ApiFail(d.error ?? `Request failed (${r.status})`, d.code ?? "error");
  return d as R;
}

interface Subject {
  slug: string;
  title: string;
  track: string;
}
interface Item {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string | null;
  kind?: string;
  encyclopedia_kind?: string | null;
  status: string;
  subject_event_id: string | null;
  subject: Subject | null;
  claims?: Array<{ count: number }>;
  claim_id?: string | null;
  evidence_category?: string | null;
}
interface ClaimRowT {
  id: string;
  statement: string;
  status: string;
  evidence: string;
  claim_references: RefRow[];
}
interface Detail {
  aliases: Array<{ alias: string; language: string }>;
  claims: Array<{ id: string; position: number; claim_id: string; claim: ClaimRowT | null }>;
  review: { decision: string; created_at: string } | null;
}

const claimCount = (i: Item, scope: Scope) => (scope === "person" ? (i.claims?.[0]?.count ?? 0) : i.claim_id ? 1 : 0);

export function PeopleAdmin({
  scope,
  canEdit,
  canReview,
  t,
}: {
  scope: Scope;
  canEdit: boolean;
  canReview: boolean;
  t: T;
}) {
  const uid = useId();
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ view: "list", scope });
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    try {
      const d = await api<{ items: Item[] }>(`/api/admin/people?${p}`);
      setItems(d.items);
    } catch (e) {
      setItems([]);
      setMsg({ tone: "err", text: (e as Error).message });
    }
  }, [scope, q, status]);
  useEffect(() => {
    void load();
  }, [load]);

  const say = (tone: "ok" | "err", text: string) => setMsg({ tone, text });
  const fail = useCallback(
    (e: unknown) =>
      setMsg({
        tone: "err",
        text: e instanceof ApiFail && e.code === "rule" ? `${t.databaseSays}: ${e.message}` : (e as Error).message,
      }),
    [t.databaseSays],
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="pp-card" aria-labelledby={`${uid}-rules`}>
        <h3 id={`${uid}-rules`}>{t.rules.heading}</h3>
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>
          {t.rules.items.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <form
        className="zq-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}
      >
        <div className="zq-field">
          <label htmlFor={`${uid}-q`}>{t.search}</label>
          <input
            id={`${uid}-q`}
            className="zq-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="zq-field">
          <label htmlFor={`${uid}-st`}>{t.statusFilter}</label>
          <select id={`${uid}-st`} className="zq-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t.allStatuses}</option>
            {["draft", "in_review", "approved", "published", "correction"].map((s) => (
              <option key={s} value={s}>
                {t.statuses[s]}
              </option>
            ))}
          </select>
        </div>
      </form>

      <div aria-live="polite">
        {msg ? (
          <p
            role={msg.tone === "err" ? "alert" : "status"}
            className={msg.tone === "err" ? "zq-error" : "zq-help"}
            data-testid="people-admin-msg"
          >
            {msg.text}
          </p>
        ) : null}
      </div>

      {!canEdit ? <p className="zq-help">{t.editorsOnly}</p> : null}

      {!items ? (
        <Skeleton height={20} />
      ) : !items.length ? (
        <EmptyState title={t.none} />
      ) : (
        <ul
          style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}
          data-testid={`${scope}-admin-list`}
        >
          {items.map((i) => {
            const isOpen = open === i.id;
            return (
              <li key={i.id} className="pp-card" data-slug={i.slug}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <EditorialStatus status={i.status as EditorialState} />
                  {scope === "person" ? (
                    <span className="zq-meta">
                      {t.kindLabel}: {i.kind}
                    </span>
                  ) : null}
                </div>
                <p style={{ margin: 0, fontWeight: 600 }}>{i.name_en}</p>
                <p className="zq-meta" style={{ margin: 0 }}>
                  {scope === "person" ? "/people/" : "/communities/"}
                  {i.slug}
                </p>
                <dl
                  className="zq-meta"
                  style={{ margin: 0, display: "grid", gridTemplateColumns: "max-content 1fr", gap: "2px 12px" }}
                >
                  {scope === "person" ? (
                    <>
                      <dt>{t.groupLabel}</dt>
                      <dd style={{ margin: 0 }}>
                        {i.encyclopedia_kind ? (t.groups[i.encyclopedia_kind] ?? i.encyclopedia_kind) : t.noGroup}
                      </dd>
                    </>
                  ) : null}
                  <dt>{t.subjectLabel}</dt>
                  <dd style={{ margin: 0 }}>{i.subject ? `${i.subject.title} (${i.subject.track})` : t.noSubject}</dd>
                  <dt>{t.count[scope]}</dt>
                  <dd style={{ margin: 0 }}>
                    {scope === "person" ? claimCount(i, scope) : claimCount(i, scope) ? t.yes : t.no}
                  </dd>
                </dl>
                <div>
                  <button
                    type="button"
                    className="zq-btn zq-btn-secondary"
                    aria-expanded={isOpen}
                    aria-controls={`${uid}-${i.id}`}
                    onClick={() => setOpen(isOpen ? null : i.id)}
                  >
                    {isOpen ? t.close : t.edit}
                    <span className="sr-only"> {i.name_en}</span>
                  </button>
                </div>
                {isOpen ? (
                  <div id={`${uid}-${i.id}`}>
                    <Editor
                      scope={scope}
                      item={i}
                      canEdit={canEdit}
                      canReview={canReview}
                      t={t}
                      onChanged={async (text) => {
                        say("ok", text);
                        await load();
                      }}
                      onError={fail}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Editor({
  scope,
  item,
  canEdit,
  canReview,
  t,
  onChanged,
  onError,
}: {
  scope: Scope;
  item: Item;
  canEdit: boolean;
  canReview: boolean;
  t: T;
  onChanged: (text: string) => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const published = item.status === "published";
  const [detail, setDetail] = useState<Detail | null>(null);
  const loadDetail = useCallback(async () => {
    if (scope !== "person") return;
    try {
      setDetail(await api<Detail>(`/api/admin/people?view=detail&scope=person&id=${item.id}`));
    } catch (e) {
      onError(e);
    }
  }, [scope, item.id, onError]);
  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const changed = async (text: string) => {
    await loadDetail();
    await onChanged(text);
  };
  const guard = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      await changed(ok);
    } catch (e) {
      onError(e);
    }
  };

  const setStatus = (to: "in_review" | "published" | "correction", note?: string) =>
    guard(
      () => api("/api/admin/people/status", "POST", { scope, id: item.id, status: to, revisionNote: note }),
      t.done.status,
    );
  const review = (decision: "approved" | "changes_requested") => {
    let comment: string | undefined;
    if (decision === "changes_requested") {
      comment = (window.prompt(t.prompts.changes) ?? "").trim();
      if (!comment) return;
    }
    void guard(
      () => api("/api/admin/review", "POST", { entityType: "person", entityId: item.id, decision, comment }),
      decision === "approved" ? t.done.review : t.done.changes,
    );
  };

  const hints =
    scope === "person" && detail
      ? personPublishHints({
          status: item.status,
          encyclopediaKind: item.encyclopedia_kind ?? null,
          subjectEventId: item.subject_event_id,
          claimStatuses: detail.claims.map((c) => c.claim?.status ?? "draft"),
          reviewDecision: detail.review?.decision ?? null,
        })
      : [];

  return (
    <div style={{ display: "grid", gap: 20, borderTop: "1px solid var(--hairline)", paddingTop: 16 }}>
      {published ? (
        <p className="zq-help" data-testid="read-only">
          {t.readOnly}
        </p>
      ) : null}

      {scope === "person" ? (
        <p className="zq-meta" style={{ margin: 0 }}>
          {t.reviewLabel}:{" "}
          {detail ? (detail.review ? detail.review.decision.replace(/_/g, " ") : t.reviewNone) : t.loading}
        </p>
      ) : null}

      <Classification
        scope={scope}
        item={item}
        editable={canEdit && !published}
        t={t}
        onSaved={() => changed(t.saved)}
        onError={onError}
      />

      {scope === "person" ? (
        <>
          <Aliases
            item={item}
            detail={detail}
            editable={canEdit && !published}
            t={t}
            onChanged={changed}
            onError={onError}
          />
          <Claims
            item={item}
            detail={detail}
            editable={canEdit && !published}
            t={t}
            onChanged={changed}
            onError={onError}
          />
        </>
      ) : null}

      {hints.length ? (
        <div data-testid="publish-hints">
          <p style={{ margin: 0, fontWeight: 600 }}>{t.hints.heading}</p>
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            {hints.map((h) => (
              <li key={h}>{t.hints[h]}</li>
            ))}
          </ul>
          <p className="zq-help">{t.hintsNote}</p>
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {canEdit && (item.status === "draft" || item.status === "correction") ? (
          <button type="button" className="zq-btn zq-btn-secondary" onClick={() => setStatus("in_review")}>
            {t.actions.sendForReview}
          </button>
        ) : null}
        {scope === "person" && canReview && !published ? (
          <>
            <button type="button" className="zq-btn zq-btn-primary" onClick={() => review("approved")}>
              {t.actions.approve}
            </button>
            <button type="button" className="zq-btn zq-btn-secondary" onClick={() => review("changes_requested")}>
              {t.actions.changes}
            </button>
          </>
        ) : null}
        {scope === "community" && (canReview || canEdit) && !published ? (
          <Link className="zq-btn zq-btn-secondary" href="/admin/life-through-ages">
            {t.actions.reviewInLta}
          </Link>
        ) : null}
        {canEdit && !published ? (
          <button type="button" className="zq-btn zq-btn-secondary" onClick={() => setStatus("published")}>
            {t.actions.publish}
          </button>
        ) : null}
        {canEdit && published ? (
          <button
            type="button"
            className="zq-btn zq-btn-secondary"
            onClick={() => {
              const note = (window.prompt(t.prompts.correction) ?? "").trim();
              if (note.length >= 3) void setStatus("correction", note);
            }}
          >
            {t.actions.correction}
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface EventHit {
  id: string;
  slug: string;
  title: string;
  track: string;
  status: string;
}

function Classification({
  scope,
  item,
  editable,
  t,
  onSaved,
  onError,
}: {
  scope: Scope;
  item: Item;
  editable: boolean;
  t: T;
  onSaved: () => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const uid = useId();
  const track = trackFor(scope, item.kind);
  const [group, setGroup] = useState<string>(item.encyclopedia_kind ?? "");
  const [subjectId, setSubjectId] = useState<string | null>(item.subject_event_id);
  const [subjectName, setSubjectName] = useState<string>(item.subject ? item.subject.title : "");
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<EventHit[] | null>(null);
  const issue = scope === "person" ? kindIssue(item.kind ?? "", group || null) : null;

  const search = async () => {
    try {
      const d = await api<{ items: EventHit[] }>(
        `/api/admin/people?view=events&track=${track}&q=${encodeURIComponent(term)}`,
      );
      setHits(d.items);
    } catch (e) {
      onError(e);
    }
  };
  const dirty = (group || null) !== (item.encyclopedia_kind ?? null) || subjectId !== item.subject_event_id;

  return (
    <fieldset
      className="zq-form"
      disabled={!editable}
      style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0, display: "grid", gap: 12 }}
    >
      <legend style={{ fontWeight: 600 }}>
        {t.groupLabel} / {t.subjectLabel}
      </legend>
      {scope === "person" ? (
        <div className="zq-field">
          <label htmlFor={`${uid}-g`}>{t.groupLabel}</label>
          <select
            id={`${uid}-g`}
            className="zq-input"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            aria-describedby={`${uid}-gh`}
            aria-invalid={issue ? true : undefined}
          >
            <option value="">{t.noGroup}</option>
            {(item.kind ? allowedKinds(item.kind) : [...ENCYCLOPEDIA_KINDS]).map((k) => (
              <option key={k} value={k}>
                {t.groups[k]}
              </option>
            ))}
          </select>
          <p id={`${uid}-gh`} className="zq-help">
            {t.groupHelp}
          </p>
          {issue ? (
            <p role="alert" className="zq-error">
              {kindIssueText(issue)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="zq-field">
        <label htmlFor={`${uid}-s`}>{t.subjectLabel}</label>
        <p className="zq-help" id={`${uid}-sh`}>
          {t.subjectHelp.replace("{track}", track)}{" "}
          <strong>{subjectId ? subjectName || subjectId : t.noSubject}</strong>
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            id={`${uid}-s`}
            className="zq-input"
            style={{ flex: "1 1 200px" }}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
            aria-describedby={`${uid}-sh`}
            maxLength={120}
          />
          <button type="button" className="zq-btn zq-btn-secondary" onClick={() => void search()}>
            {t.subjectSearch}
          </button>
          {subjectId ? (
            <button
              type="button"
              className="zq-btn zq-btn-quiet"
              onClick={() => {
                setSubjectId(null);
                setSubjectName("");
              }}
            >
              {t.subjectClear}
            </button>
          ) : null}
        </div>
        {hits ? (
          hits.length ? (
            <ul
              style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}
              data-testid="subject-hits"
            >
              {hits.map((h) => (
                <li key={h.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span>
                    {h.title}{" "}
                    <span className="zq-meta">
                      /events/{h.slug} · {t.statuses[h.status] ?? h.status}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="zq-btn zq-btn-secondary"
                    onClick={() => {
                      setSubjectId(h.id);
                      setSubjectName(h.title);
                      setHits(null);
                    }}
                  >
                    {t.subjectUse}
                    <span className="sr-only"> {h.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="zq-help">{t.none}</p>
          )
        ) : null}
      </div>

      {editable ? (
        <div>
          <button
            type="button"
            className="zq-btn zq-btn-primary"
            disabled={!dirty || !!issue}
            onClick={async () => {
              try {
                await api("/api/admin/people", "POST", {
                  scope,
                  id: item.id,
                  ...(scope === "person" ? { encyclopediaKind: group || null } : {}),
                  subjectEventId: subjectId,
                });
                await onSaved();
              } catch (e) {
                onError(e);
              }
            }}
          >
            {t.save}
          </button>
        </div>
      ) : null}
    </fieldset>
  );
}

function Aliases({
  item,
  detail,
  editable,
  t,
  onChanged,
  onError,
}: {
  item: Item;
  detail: Detail | null;
  editable: boolean;
  t: T;
  onChanged: (s: string) => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const uid = useId();
  const [alias, setAlias] = useState("");
  const [language, setLanguage] = useState("en");
  return (
    <section aria-labelledby={`${uid}-h`} style={{ display: "grid", gap: 8 }}>
      <h4 id={`${uid}-h`} style={{ margin: 0 }}>
        {t.aliases}
      </h4>
      {!detail ? (
        <Skeleton height={16} />
      ) : detail.aliases.length ? (
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>
          {detail.aliases.map((a) => (
            <li key={a.alias}>
              <span lang={a.language}>{a.alias}</span> <span className="zq-meta">({a.language})</span>{" "}
              {editable ? (
                <button
                  type="button"
                  className="zq-btn zq-btn-quiet"
                  onClick={async () => {
                    try {
                      await api("/api/admin/people/aliases", "DELETE", { personId: item.id, alias: a.alias });
                      await onChanged(t.saved);
                    } catch (e) {
                      onError(e);
                    }
                  }}
                >
                  {t.aliasRemove}
                  <span className="sr-only"> {a.alias}</span>
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="zq-help">{t.aliasNone}</p>
      )}
      {editable ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <div className="zq-field" style={{ flex: "1 1 180px" }}>
            <label htmlFor={`${uid}-a`}>{t.aliasText}</label>
            <input
              id={`${uid}-a`}
              className="zq-input"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="zq-field" style={{ flex: "0 1 120px" }}>
            <label htmlFor={`${uid}-l`}>{t.aliasLanguage}</label>
            <input
              id={`${uid}-l`}
              className="zq-input"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              maxLength={3}
            />
          </div>
          <button
            type="button"
            className="zq-btn zq-btn-secondary"
            disabled={!alias.trim()}
            onClick={async () => {
              try {
                await api("/api/admin/people/aliases", "POST", { personId: item.id, alias, language });
                setAlias("");
                await onChanged(t.saved);
              } catch (e) {
                onError(e);
              }
            }}
          >
            {t.aliasAdd}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Claims({
  item,
  detail,
  editable,
  t,
  onChanged,
  onError,
}: {
  item: Item;
  detail: Detail | null;
  editable: boolean;
  t: T;
  onChanged: (s: string) => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const uid = useId();
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<ClaimRowT[] | null>(null);
  const attached = new Set((detail?.claims ?? []).map((c) => c.claim_id));
  const search = async () => {
    try {
      const d = await api<{ items: ClaimRowT[] }>(`/api/admin/people?view=claims&q=${encodeURIComponent(term)}`);
      setHits(d.items);
    } catch (e) {
      onError(e);
    }
  };
  const refs = (c: ClaimRowT | null) => {
    const r = quranRefs(c?.claim_references);
    return r.length ? `${t.claimRefs} ${r.join(", ")}` : t.claimNoRefs;
  };
  return (
    <section aria-labelledby={`${uid}-h`} style={{ display: "grid", gap: 8 }}>
      <h4 id={`${uid}-h`} style={{ margin: 0 }}>
        {t.claims}
      </h4>
      {!detail ? (
        <Skeleton height={16} />
      ) : detail.claims.length ? (
        <ul style={{ margin: 0, paddingInlineStart: 20, display: "grid", gap: 8 }} data-testid="person-claims">
          {detail.claims.map((c) => (
            <li key={c.id}>
              <span>{c.claim?.statement ?? c.claim_id}</span>
              <br />
              <span className="zq-meta">
                {refs(c.claim)} · {t.claimStatus}: {c.claim?.status}
              </span>{" "}
              {editable ? (
                <button
                  type="button"
                  className="zq-btn zq-btn-quiet"
                  onClick={async () => {
                    try {
                      await api("/api/admin/people/claims", "DELETE", { id: c.id });
                      await onChanged(t.saved);
                    } catch (e) {
                      onError(e);
                    }
                  }}
                >
                  {t.claimDetach}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="zq-help">{t.claimNone}</p>
      )}
      {editable ? (
        <div className="zq-field">
          <label htmlFor={`${uid}-q`}>{t.claimSearch}</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              id={`${uid}-q`}
              className="zq-input"
              style={{ flex: "1 1 200px" }}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
              maxLength={120}
            />
            <button type="button" className="zq-btn zq-btn-secondary" onClick={() => void search()}>
              {t.claimFind}
            </button>
          </div>
          {hits ? (
            hits.length ? (
              <ul
                style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}
                data-testid="claim-hits"
              >
                {hits.map((h) => (
                  <li key={h.id}>
                    <span>{h.statement}</span>
                    <br />
                    <span className="zq-meta">
                      {refs(h)} · {t.claimStatus}: {h.status}
                    </span>{" "}
                    <button
                      type="button"
                      className="zq-btn zq-btn-secondary"
                      disabled={attached.has(h.id)}
                      onClick={async () => {
                        try {
                          await api("/api/admin/people/claims", "POST", { personId: item.id, claimId: h.id });
                          setHits(null);
                          await onChanged(t.saved);
                        } catch (e) {
                          onError(e);
                        }
                      }}
                    >
                      {t.claimAttach}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="zq-help">{t.none}</p>
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
