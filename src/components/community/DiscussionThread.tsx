"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/account/useSession";
import { supabaseConfigured } from "@/lib/env";
import { Comment, IconButton } from "@/components/ui/cards";
import { CitationChip } from "@/components/ui/evidence";
import { EmptyState, Skeleton, Toast } from "@/components/ui/misc";
import { apiErrorText } from "@/lib/i18n/modules/api";
import { communityStrings } from "@/lib/i18n/modules/community";
import { useLocale } from "@/lib/i18n/useLocale";

interface CommentRow {
  id: string;
  parent_id: string | null;
  status: "visible" | "hidden" | "removed";
  body: string | null;
  citation: string | null;
  author_name: string | null;
  created_at: string;
  edited_at: string | null;
  is_mine: boolean;
  can_edit: boolean;
}
interface DiscussionRow {
  id: string;
  title: string;
  status: string;
  content_type: string;
  content_id: string;
}

const REASONS = ["misleading", "disrespectful", "spam", "personal_information", "other"] as const;

function contentHref(type: string, id: string): string | null {
  if (type === "journey_stop") return `/prophets/${id}`;
  if (type === "quran_verse") {
    const [s, a] = id.split(":");
    return `/quran/${s}#ayah-${a}`;
  }
  if (type === "story") return `/stories/${id}`;
  return null;
}

/** A full thread: threaded comments, cite-a-verse, edit window, delete, report and follow. */
export function DiscussionThread({ id }: { id: string }) {
  const session = useSession();
  const locale = useLocale();
  const t = communityStrings(locale);
  const [data, setData] = useState<{ discussion: DiscussionRow; comments: CommentRow[] } | "loading" | "unavailable" | "missing" | "error">("loading");
  const [toast, setToast] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!supabaseConfigured()) return setData("unavailable");
    const r = await fetch(`/api/discussions/${id}/comments`, { cache: "no-store" }).catch(() => null);
    if (!r) return setData("error");
    if (r.status === 503) return setData("unavailable");
    if (r.status === 404) return setData("missing");
    if (!r.ok) return setData("error");
    setData(await r.json());
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const say = (tone: "success" | "error", text: string) => {
    setToast({ tone, text });
    setTimeout(() => setToast(null), 4000);
  };
  const call = async (url: string, method: string, body?: unknown) => {
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = (await r.json().catch(() => ({}))) as { error?: string; code?: string };
    if (!r.ok) throw new Error(apiErrorText(locale, d, t.error));
    return d;
  };

  const tree = useMemo(() => {
    if (typeof data !== "object") return [];
    const by = new Map<string | null, CommentRow[]>();
    for (const c of data.comments) {
      const k = c.parent_id && data.comments.some((p) => p.id === c.parent_id) ? c.parent_id : null;
      by.set(k, [...(by.get(k) ?? []), c]);
    }
    const out: Array<{ c: CommentRow; depth: number }> = [];
    const walk = (parent: string | null, depth: number) => {
      for (const c of by.get(parent) ?? []) {
        out.push({ c, depth });
        walk(c.id, Math.min(depth + 1, 3));
      }
    };
    walk(null, 0);
    return out;
  }, [data]);

  if (data === "loading")
    return (
      <div aria-busy="true" style={{ display: "grid", gap: 10 }}>
        <Skeleton height={28} width="50%" />
        <Skeleton height={16} />
        <Skeleton height={16} width="80%" />
      </div>
    );
  if (data === "unavailable")
    return (
      <EmptyState tone="soon" label={<span className="zq-soon">{t.soon}</span>} title={t.notOpen}>
        <p>{t.notConnectedShort}</p>
      </EmptyState>
    );
  if (data === "missing") return <EmptyState title={t.missing} />;
  if (data === "error")
    return (
      <EmptyState title={t.threadError}>
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => void load()}>
          {t.retry}
        </button>
      </EmptyState>
    );

  const signedIn = session.status === "signed_in";
  const open = data.discussion.status === "open";
  const href = contentHref(data.discussion.content_type, data.discussion.content_id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {href ? (
          <CitationChip kind={t.about} href={href}>
            {data.discussion.content_id}
          </CitationChip>
        ) : null}
        {data.discussion.status === "locked" ? <span className="zq-soon">{t.lockedBy}</span> : null}
        {signedIn ? (
          <button
            type="button"
            className="zq-btn zq-btn-secondary zq-btn-sm"
            aria-pressed={following ?? undefined}
            onClick={async () => {
              const next = !following;
              try {
                await call("/api/follows", "POST", { discussionId: id, follow: next });
                setFollowing(next);
                say("success", next ? t.followed : t.unfollowed);
              } catch (e) {
                say("error", (e as Error).message);
              }
            }}
          >
            {following ? t.following : t.follow}
          </button>
        ) : null}
      </div>

      {tree.length === 0 ? <p className="zq-meta">{t.noComments}</p> : null}
      <div>
        {tree.map(({ c, depth }) => (
          <div key={c.id} style={{ marginInlineStart: depth * 24 }} id={`c-${c.id}`}>
            {editing === c.id ? (
              <CommentForm
                label={t.editLabel}
                initial={c.body ?? ""}
                submitLabel={t.saveEdit}
                onCancel={() => setEditing(null)}
                onSubmit={async (body) => {
                  await call(`/api/discussions/${id}/comments/${c.id}`, "PATCH", { body });
                  setEditing(null);
                  await load();
                  say("success", t.edited);
                }}
              />
            ) : (
              <Comment
                author={c.author_name ?? t.reader}
                time={new Date(c.created_at).toLocaleString(locale)}
                body={c.body ?? undefined}
                citation={c.citation ?? undefined}
                edited={Boolean(c.edited_at)}
                status={c.status}
                actions={
                  signedIn ? (
                    <>
                      {open ? (
                        <IconButton icon="discuss" onClick={() => setReplyTo(c.id)}>
                          {t.reply}
                        </IconButton>
                      ) : null}
                      {c.can_edit ? (
                        <IconButton icon="source" onClick={() => setEditing(c.id)}>
                          {t.edit}
                        </IconButton>
                      ) : null}
                      {c.is_mine ? (
                        <IconButton
                          icon="close"
                          onClick={async () => {
                            if (!window.confirm(t.confirmDelete)) return;
                            try {
                              await call(`/api/discussions/${id}/comments/${c.id}`, "DELETE");
                              await load();
                              say("success", t.deleted);
                            } catch (e) {
                              say("error", (e as Error).message);
                            }
                          }}
                        >
                          {t.delete}
                        </IconButton>
                      ) : (
                        <IconButton icon="flag" onClick={() => setReporting(c.id)} aria-expanded={reporting === c.id}>
                          {t.report}
                        </IconButton>
                      )}
                    </>
                  ) : null
                }
              />
            )}
            {reporting === c.id ? (
              <ReportForm
                t={t}
                onCancel={() => setReporting(null)}
                onSubmit={async (reason, details) => {
                  try {
                    await call("/api/reports", "POST", { targetType: "comment", targetId: c.id, reason, details: details || undefined });
                    setReporting(null);
                    say("success", t.reported);
                  } catch (e) {
                    say("error", (e as Error).message);
                  }
                }}
              />
            ) : null}
            {replyTo === c.id ? (
              <CommentForm
                label={t.replyTo(c.author_name ?? t.thisComment)}
                submitLabel={t.postReply}
                onCancel={() => setReplyTo(null)}
                onSubmit={async (body, citation) => {
                  await call(`/api/discussions/${id}/comments`, "POST", { body, parentId: c.id, citation: citation || undefined });
                  setReplyTo(null);
                  await load();
                  say("success", t.posted);
                }}
              />
            ) : null}
          </div>
        ))}
      </div>

      {open && signedIn ? (
        <CommentForm
          label={t.addComment}
          submitLabel={t.postComment}
          onSubmit={async (body, citation) => {
            await call(`/api/discussions/${id}/comments`, "POST", { body, citation: citation || undefined });
            await load();
            say("success", t.posted);
          }}
        />
      ) : session.status === "signed_out" ? (
        <div>
          <Link className="zq-btn zq-btn-secondary zq-btn-link" href={`/sign-in?returnTo=${encodeURIComponent(`/community/${id}`)}`}>
            {t.signInToComment}
          </Link>
        </div>
      ) : null}
      {toast ? (
        <div style={{ position: "fixed", insetInlineEnd: 16, bottom: 16, zIndex: "var(--z-toast)" as unknown as number }}>
          <Toast tone={toast.tone}>{toast.text}</Toast>
        </div>
      ) : null}
    </div>
  );
}

function CommentForm({ label, initial = "", submitLabel, onSubmit, onCancel }: { label: string; initial?: string; submitLabel: string; onSubmit: (body: string, citation: string) => Promise<void>; onCancel?: () => void }) {
  const t = communityStrings(useLocale());
  const [body, setBody] = useState(initial);
  const [citation, setCitation] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fid = useMemo(() => `cf-${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <form
      className="zq-form"
      style={{ maxWidth: 640, margin: "12px 0" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await onSubmit(body, citation.trim());
          setBody("");
          setCitation("");
        } catch (x) {
          setErr((x as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="zq-field" style={{ maxWidth: "none" }}>
        <label htmlFor={`${fid}-b`}>{label}</label>
        <textarea id={`${fid}-b`} className="zq-textarea" value={body} onChange={(e) => setBody(e.target.value)} minLength={2} maxLength={5000} required />
      </div>
      {!initial ? (
        <div className="zq-field">
          <label htmlFor={`${fid}-c`}>{t.cite}</label>
          <input
            id={`${fid}-c`}
            className="zq-input"
            dir="ltr"
            lang="en"
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            placeholder="Q 12:3 or Bukhari 1"
            pattern="^(Q \d{1,3}:\d{1,3}([–-]\d{1,3})?|[A-Za-z' -]{2,40} \d{1,6}[a-z]?)$"
            aria-describedby={`${fid}-ch`}
          />
          <span className="zq-help" id={`${fid}-ch`}>
            {t.citeHelp}
          </span>
        </div>
      ) : null}
      {err ? (
        <p className="zq-error" role="alert">
          {err}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="zq-btn zq-btn-primary" disabled={busy || body.trim().length < 2} aria-busy={busy || undefined}>
          {busy ? t.posting : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="zq-btn zq-btn-quiet" onClick={onCancel}>
            {t.cancel}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function ReportForm({ t, onSubmit, onCancel }: { t: ReturnType<typeof communityStrings>; onSubmit: (reason: string, details: string) => Promise<void>; onCancel: () => void }) {
  const [reason, setReason] = useState<string>("misleading");
  const [details, setDetails] = useState("");
  return (
    <form
      className="zq-form pp-card"
      style={{ margin: "8px 0 16px", maxWidth: 520 }}
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(reason, details);
      }}
    >
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 6 }}>
        <legend className="zq-eyebrow" style={{ marginBottom: 6 }}>
          {t.why}
        </legend>
        {REASONS.map((v) => (
          <label key={v} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} /> {t.reasons[v]}
          </label>
        ))}
      </fieldset>
      <div className="zq-field">
        <label htmlFor="report-details">{t.details}</label>
        <textarea id="report-details" className="zq-textarea" style={{ minHeight: 72 }} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="zq-btn zq-btn-danger">
          {t.sendReport}
        </button>
        <button type="button" className="zq-btn zq-btn-quiet" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
