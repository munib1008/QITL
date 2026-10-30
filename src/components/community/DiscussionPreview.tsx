"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/account/useSession";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { EvidenceLabel } from "@/components/ui/evidence";
import type { BookmarkTargetType } from "@/lib/validation";

interface Thread {
  id: string;
  title: string;
  status: string;
  created_at: string;
  comments: Array<{ count: number }>;
}

type State = { s: "loading" } | { s: "unavailable" } | { s: "error" } | { s: "ok"; threads: Thread[] };

/** Threads attached to a piece of content. Reading is public; starting a thread needs an account. */
export function DiscussionPreview({ contentType, contentId }: { contentType: BookmarkTargetType; contentId: string }) {
  const session = useSession();
  const [st, setSt] = useState<State>({ s: "loading" });
  const [title, setTitle] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    fetch(`/api/discussions?${new URLSearchParams({ contentType, contentId })}`)
      .then(async (r) => {
        if (r.status === 503) return setSt({ s: "unavailable" });
        if (!r.ok) return setSt({ s: "error" });
        const d = (await r.json()) as { discussions: Thread[] };
        setSt({ s: "ok", threads: d.discussions });
      })
      .catch(() => setSt({ s: "error" }));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, contentId]);

  if (st.s === "loading")
    return (
      <div aria-busy="true" style={{ display: "grid", gap: 8 }}>
        <Skeleton height={20} width="60%" />
        <Skeleton height={16} />
      </div>
    );
  if (st.s === "unavailable")
    return (
      <EmptyState tone="soon" label={<span className="zq-soon">Coming soon</span>} title="Discussions are not open yet.">
        <p>Discussion needs the community database, which is not connected on this site yet. Nothing here is mocked.</p>
      </EmptyState>
    );
  if (st.s === "error")
    return (
      <EmptyState label={<EvidenceLabel kind="unknown">Not loaded</EvidenceLabel>} title="Discussions could not be loaded.">
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => void load()}>
          Retry
        </button>
      </EmptyState>
    );

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setErr(null);
    const r = await fetch("/api/discussions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentType, contentId, title }) });
    setPosting(false);
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      return setErr(d.error ?? "Could not start the discussion.");
    }
    const d = (await r.json()) as { id: string };
    window.location.assign(`/community/${d.id}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {st.threads.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {st.threads.map((t) => (
            <li key={t.id} className="zq-result">
              <Link className="title" href={`/community/${t.id}`}>
                {t.title}
              </Link>
              <span className="zq-meta">
                {t.comments[0]?.count ?? 0} comments · {new Date(t.created_at).toLocaleDateString()}
                {t.status === "locked" ? " · locked" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="zq-meta">No discussion yet.</p>
      )}
      {session.status === "signed_in" ? (
        <form onSubmit={start} className="zq-form" aria-label="Start a discussion">
          <div className="zq-field">
            <label htmlFor={`new-thread-${contentId}`}>Start a discussion</label>
            <input id={`new-thread-${contentId}`} className="zq-input" value={title} onChange={(e) => setTitle(e.target.value)} minLength={4} maxLength={160} required placeholder="Ask a question about this page" />
          </div>
          {err ? (
            <p className="zq-error" role="alert">
              {err}
            </p>
          ) : null}
          <div>
            <button type="submit" className="zq-btn zq-btn-primary" disabled={posting || title.trim().length < 4} aria-busy={posting || undefined}>
              {posting ? "Starting" : "Start discussion"}
            </button>
          </div>
        </form>
      ) : session.status === "signed_out" ? (
        <div>
          <Link className="zq-btn zq-btn-secondary zq-btn-link" href={`/sign-in?returnTo=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname + "#discuss")}`}>
            Sign in to join the discussion
          </Link>
        </div>
      ) : null}
      <p className="zq-meta">
        Comments are readers&apos; views, not verified knowledge. <Link href="/community/guidelines">Discussion guidelines</Link>
      </p>
    </div>
  );
}
