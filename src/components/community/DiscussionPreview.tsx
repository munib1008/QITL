"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/account/useSession";
import { supabaseConfigured } from "@/lib/env";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { EvidenceLabel } from "@/components/ui/evidence";
import type { BookmarkTargetType } from "@/lib/validation";
import { apiErrorText } from "@/lib/i18n/modules/api";
import { communityStrings } from "@/lib/i18n/modules/community";
import { useLocale } from "@/lib/i18n/useLocale";

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
  const locale = useLocale();
  const c = communityStrings(locale);
  const [st, setSt] = useState<State>({ s: "loading" });
  const [title, setTitle] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    !supabaseConfigured()
      ? Promise.resolve(setSt({ s: "unavailable" }))
      : fetch(`/api/discussions?${new URLSearchParams({ contentType, contentId })}`)
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
      <EmptyState tone="soon" label={<span className="zq-soon">{c.soon}</span>} title={c.notOpen}>
        <p>{c.previewNotConnected}</p>
      </EmptyState>
    );
  if (st.s === "error")
    return (
      <EmptyState label={<EvidenceLabel kind="unknown">{c.notLoaded}</EvidenceLabel>} title={c.couldNotLoad}>
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => void load()}>
          {c.retry}
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
      const d = (await r.json().catch(() => ({}))) as { error?: string; code?: string };
      return setErr(apiErrorText(locale, d, c.couldNotStart));
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
              <Link className="title" href={`/community/${t.id}`} lang={locale === "en" ? undefined : "en"}>
                {t.title}
              </Link>
              <span className="zq-meta">
                {c.comments(t.comments[0]?.count ?? 0)} · {new Date(t.created_at).toLocaleDateString(locale)}
                {t.status === "locked" ? ` · ${c.locked}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="zq-meta">{c.noneYet}</p>
      )}
      {session.status === "signed_in" ? (
        <form onSubmit={start} className="zq-form" aria-label={c.start}>
          <div className="zq-field">
            <label htmlFor={`new-thread-${contentId}`}>{c.start}</label>
            <input id={`new-thread-${contentId}`} className="zq-input" value={title} onChange={(e) => setTitle(e.target.value)} minLength={4} maxLength={160} required placeholder={c.startPlaceholder} />
          </div>
          {err ? (
            <p className="zq-error" role="alert">
              {err}
            </p>
          ) : null}
          <div>
            <button type="submit" className="zq-btn zq-btn-primary" disabled={posting || title.trim().length < 4} aria-busy={posting || undefined}>
              {posting ? c.starting : c.startButton}
            </button>
          </div>
        </form>
      ) : session.status === "signed_out" ? (
        <div>
          <Link className="zq-btn zq-btn-secondary zq-btn-link" href={`/sign-in?returnTo=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname + "#discuss")}`}>
            {c.signInToJoin}
          </Link>
        </div>
      ) : null}
      <p className="zq-meta">
        {c.readersViews} <Link href="/community/guidelines">{c.guidelines}</Link>
      </p>
    </div>
  );
}
