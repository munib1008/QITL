"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/account/useSession";
import { supabaseConfigured } from "@/lib/env";
import { Comment, IconButton } from "@/components/ui/cards";
import { CitationChip } from "@/components/ui/evidence";
import { EmptyState, Skeleton, Toast } from "@/components/ui/misc";

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

const REASONS = [
  ["misleading", "Misleading about the sources"],
  ["disrespectful", "Disrespectful"],
  ["spam", "Spam"],
  ["personal_information", "Shares personal information"],
  ["other", "Something else"],
] as const;

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
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) throw new Error(d.error ?? "Something went wrong.");
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
      <EmptyState tone="soon" label={<span className="zq-soon">Coming soon</span>} title="Discussions are not open yet.">
        <p>The community database is not connected on this site yet.</p>
      </EmptyState>
    );
  if (data === "missing") return <EmptyState title="This discussion does not exist or was removed." />;
  if (data === "error")
    return (
      <EmptyState title="The discussion could not be loaded.">
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => void load()}>
          Retry
        </button>
      </EmptyState>
    );

  const signedIn = session.status === "signed_in";
  const open = data.discussion.status === "open";
  const href = contentHref(data.discussion.content_type, data.discussion.content_id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {href ? <CitationChip kind="About" href={href}>{data.discussion.content_id}</CitationChip> : null}
        {data.discussion.status === "locked" ? <span className="zq-soon">Locked by a moderator</span> : null}
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
                say("success", next ? "Following. Activity goes to your notifications and digest." : "Unfollowed.");
              } catch (e) {
                say("error", (e as Error).message);
              }
            }}
          >
            {following ? "Following" : "Follow thread"}
          </button>
        ) : null}
      </div>

      {tree.length === 0 ? <p className="zq-meta">No comments yet.</p> : null}
      <div>
        {tree.map(({ c, depth }) => (
          <div key={c.id} style={{ marginInlineStart: depth * 24 }} id={`c-${c.id}`}>
            {editing === c.id ? (
              <CommentForm
                label="Edit your comment"
                initial={c.body ?? ""}
                submitLabel="Save edit"
                onCancel={() => setEditing(null)}
                onSubmit={async (body) => {
                  await call(`/api/discussions/${id}/comments/${c.id}`, "PATCH", { body });
                  setEditing(null);
                  await load();
                  say("success", "Edited.");
                }}
              />
            ) : (
              <Comment
                author={c.author_name ?? "Reader"}
                time={new Date(c.created_at).toLocaleString()}
                body={c.body ?? undefined}
                citation={c.citation ?? undefined}
                edited={Boolean(c.edited_at)}
                status={c.status}
                actions={
                  signedIn ? (
                    <>
                      {open ? (
                        <IconButton icon="discuss" onClick={() => setReplyTo(c.id)}>
                          Reply
                        </IconButton>
                      ) : null}
                      {c.can_edit ? (
                        <IconButton icon="source" onClick={() => setEditing(c.id)}>
                          Edit
                        </IconButton>
                      ) : null}
                      {c.is_mine ? (
                        <IconButton
                          icon="close"
                          onClick={async () => {
                            if (!window.confirm("Delete your comment? This cannot be undone.")) return;
                            try {
                              await call(`/api/discussions/${id}/comments/${c.id}`, "DELETE");
                              await load();
                              say("success", "Deleted.");
                            } catch (e) {
                              say("error", (e as Error).message);
                            }
                          }}
                        >
                          Delete
                        </IconButton>
                      ) : (
                        <IconButton icon="flag" onClick={() => setReporting(c.id)} aria-expanded={reporting === c.id}>
                          Report
                        </IconButton>
                      )}
                    </>
                  ) : null
                }
              />
            )}
            {reporting === c.id ? (
              <ReportForm
                onCancel={() => setReporting(null)}
                onSubmit={async (reason, details) => {
                  try {
                    await call("/api/reports", "POST", { targetType: "comment", targetId: c.id, reason, details: details || undefined });
                    setReporting(null);
                    say("success", "Reported. A moderator will review it.");
                  } catch (e) {
                    say("error", (e as Error).message);
                  }
                }}
              />
            ) : null}
            {replyTo === c.id ? (
              <CommentForm
                label={`Reply to ${c.author_name ?? "this comment"}`}
                submitLabel="Post reply"
                onCancel={() => setReplyTo(null)}
                onSubmit={async (body, citation) => {
                  await call(`/api/discussions/${id}/comments`, "POST", { body, parentId: c.id, citation: citation || undefined });
                  setReplyTo(null);
                  await load();
                  say("success", "Posted.");
                }}
              />
            ) : null}
          </div>
        ))}
      </div>

      {open && signedIn ? (
        <CommentForm
          label="Add a comment"
          submitLabel="Post comment"
          onSubmit={async (body, citation) => {
            await call(`/api/discussions/${id}/comments`, "POST", { body, citation: citation || undefined });
            await load();
            say("success", "Posted.");
          }}
        />
      ) : session.status === "signed_out" ? (
        <div>
          <Link className="zq-btn zq-btn-secondary zq-btn-link" href={`/sign-in?returnTo=${encodeURIComponent(`/community/${id}`)}`}>
            Sign in to comment
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
          <label htmlFor={`${fid}-c`}>Cite a verse or narration (optional)</label>
          <input
            id={`${fid}-c`}
            className="zq-input"
            dir="ltr"
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            placeholder="Q 12:3 or Bukhari 1"
            pattern="^(Q \d{1,3}:\d{1,3}([–-]\d{1,3})?|[A-Za-z' -]{2,40} \d{1,6}[a-z]?)$"
            aria-describedby={`${fid}-ch`}
          />
          <span className="zq-help" id={`${fid}-ch`}>
            Write the reference exactly; it is shown as a citation chip beside your comment.
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
          {busy ? "Posting" : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="zq-btn zq-btn-quiet" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function ReportForm({ onSubmit, onCancel }: { onSubmit: (reason: string, details: string) => Promise<void>; onCancel: () => void }) {
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
          Why are you reporting this?
        </legend>
        {REASONS.map(([v, t]) => (
          <label key={v} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} /> {t}
          </label>
        ))}
      </fieldset>
      <div className="zq-field">
        <label htmlFor="report-details">Details for the moderator (optional)</label>
        <textarea id="report-details" className="zq-textarea" style={{ minHeight: 72 }} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="zq-btn zq-btn-danger">
          Send report
        </button>
        <button type="button" className="zq-btn zq-btn-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
