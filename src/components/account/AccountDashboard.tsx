"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EmptyState, Skeleton } from "@/components/ui/misc";

interface Bookmark {
  id: string;
  target_type: string;
  target_id: string;
  created_at: string;
}
interface Progress {
  chapter_id: string;
  percent: number;
  completed_at: string | null;
  chapters: { title: string; position: number; stories: { slug: string; title: string } | null } | null;
}
interface Note {
  id: string;
  target_type: string;
  target_id: string;
  body: string;
  updated_at: string;
}

function targetHref(type: string, id: string): string {
  switch (type) {
    case "journey_stop":
      return `/prophets/${id}`;
    case "quran_verse": {
      const [s, a] = id.split(":");
      return `/quran/${s}#ayah-${a}`;
    }
    case "hadith": {
      const [c, n] = id.split(":");
      return `/hadith/${c}/${n}`;
    }
    case "story":
      return `/stories/${id}`;
    default:
      return "/";
  }
}
function targetLabel(type: string, id: string, names: Record<string, string>): string {
  if (type === "journey_stop") return names[id] ?? id;
  if (type === "quran_verse") return `Q ${id}`;
  if (type === "hadith") return id.replace(":", " ");
  return id;
}

/** The signed-in reader's library, settings and data controls (export, delete). */
export function AccountDashboard({ email, names }: { email: string; names: Record<string, string> }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);
  const [progress, setProgress] = useState<Progress[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [digest, setDigest] = useState<string>("weekly");
  const [prefsState, setPrefsState] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [delState, setDelState] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const get = <T,>(u: string, k: string) =>
      fetch(u, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
        .then((d) => d[k] as T);
    get<Bookmark[]>("/api/me/bookmarks", "bookmarks").then(setBookmarks).catch(() => setError(true));
    get<Progress[]>("/api/me/progress", "progress").then(setProgress).catch(() => setError(true));
    get<Note[]>("/api/me/notes", "notes").then(setNotes).catch(() => setError(true));
    getBrowserSupabase()
      ?.from("notification_prefs")
      .select("digest")
      .maybeSingle()
      .then(({ data }) => data && setDigest((data as { digest: string }).digest));
  }, []);

  const loading = <Skeleton height={18} />;
  const resume = progress?.find((p) => !p.completed_at && p.chapters?.stories);

  return (
    <div style={{ display: "grid", gap: 32 }}>
      {error ? (
        <p className="zq-error" role="alert">
          Some of your library could not be loaded. Refresh to try again.
        </p>
      ) : null}
      {resume?.chapters?.stories ? (
        <section className="pp-card" aria-labelledby="resume-h">
          <h3 id="resume-h">Continue reading</h3>
          <Link className="zq-btn zq-btn-primary zq-btn-link" href={`/stories/${resume.chapters.stories.slug}?chapter=${resume.chapters.position}`}>
            {resume.chapters.stories.title}: {resume.chapters.title} ({Math.round(resume.percent)}%)
          </Link>
        </section>
      ) : null}

      <section aria-labelledby="bm-h">
        <h2 id="bm-h" className="zq-eyebrow">
          Bookmarks
        </h2>
        {bookmarks == null ? loading : bookmarks.length ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {bookmarks.map((b) => (
              <li key={b.id} className="zq-result" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Link href={targetHref(b.target_type, b.target_id)}>{targetLabel(b.target_type, b.target_id, names)}</Link>
                <button
                  type="button"
                  className="zq-btn zq-btn-quiet zq-btn-sm"
                  onClick={async () => {
                    const r = await fetch("/api/me/bookmarks", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: b.target_type, id: b.target_id }) });
                    if (r.ok) setBookmarks((x) => x?.filter((y) => y.id !== b.id) ?? null);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No bookmarks yet.">
            <p>Use Bookmark on any prophet, ayah or story.</p>
          </EmptyState>
        )}
      </section>

      <section aria-labelledby="pr-h">
        <h2 id="pr-h" className="zq-eyebrow">
          Reading progress
        </h2>
        {progress == null ? loading : progress.length ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {progress.map((p) => (
              <li key={p.chapter_id} className="zq-result">
                {p.chapters?.stories ? (
                  <Link href={`/stories/${p.chapters.stories.slug}?chapter=${p.chapters.position}`}>
                    {p.chapters.stories.title}: {p.chapters.title}
                  </Link>
                ) : (
                  <span>Chapter</span>
                )}
                <span className="zq-meta">{p.completed_at ? "Completed" : `${Math.round(p.percent)}% read`}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="zq-meta">Progress is recorded as you read published stories.</p>
        )}
      </section>

      <section aria-labelledby="nt-h">
        <h2 id="nt-h" className="zq-eyebrow">
          Private notes
        </h2>
        {notes == null ? loading : notes.length ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {notes.map((n) => (
              <li key={n.id} className="zq-result">
                <Link href={targetHref(n.target_type, n.target_id)}>{targetLabel(n.target_type, n.target_id, names)}</Link>
                <span className="zq-meta" style={{ whiteSpace: "pre-wrap" }}>
                  {n.body.slice(0, 280)}
                  {n.body.length > 280 ? "…" : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="zq-meta">No notes yet. Notes are private: only you can read them.</p>
        )}
      </section>

      <section aria-labelledby="set-h" className="pp-card">
        <h3 id="set-h">Notifications</h3>
        <div className="zq-field">
          <label htmlFor="digest">Email digest of followed discussions</label>
          <select
            id="digest"
            className="zq-input"
            value={digest}
            onChange={async (e) => {
              const v = e.target.value;
              setDigest(v);
              setPrefsState("Saving…");
              const sb = getBrowserSupabase();
              const { error: err } = (await sb?.from("notification_prefs").update({ digest: v, updated_at: new Date().toISOString() }).not("user_id", "is", null)) ?? { error: true };
              setPrefsState(err ? "Not saved. Try again." : "Saved.");
            }}
          >
            <option value="off">Off</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <span className="zq-help" role="status">
            {prefsState ?? "Every digest has a one-click unsubscribe link."}
          </span>
        </div>
      </section>

      <section aria-labelledby="data-h" className="pp-card">
        <h3 id="data-h">Your data</h3>
        <p className="zq-meta" style={{ margin: 0 }}>
          Signed in as {email}.
        </p>
        <form method="post" action="/api/me/export">
          <button type="submit" className="zq-btn zq-btn-secondary">
            Export my data (JSON)
          </button>
        </form>
        <button
          type="button"
          className="zq-btn zq-btn-quiet"
          onClick={async () => {
            await getBrowserSupabase()?.auth.signOut();
            window.location.assign("/");
          }}
        >
          Sign out
        </button>
        <div className="zq-field" style={{ marginTop: 16 }}>
          <label htmlFor="del">Delete my account</label>
          <input id="del" className="zq-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE MY ACCOUNT" aria-describedby="del-h" />
          <span className="zq-help" id="del-h">
            Type DELETE MY ACCOUNT to confirm. Your bookmarks, notes, progress, follows and comments are deleted permanently.
          </span>
        </div>
        <div>
          <button
            type="button"
            className="zq-btn zq-btn-danger"
            disabled={confirm !== "DELETE MY ACCOUNT"}
            onClick={async () => {
              setDelState("Deleting…");
              const r = await fetch("/api/me/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm }) });
              const d = (await r.json().catch(() => ({}))) as { error?: string };
              if (r.ok) window.location.assign("/?deleted=1");
              else setDelState(d.error ?? "Deletion failed. Nothing was deleted.");
            }}
          >
            Delete account permanently
          </button>
        </div>
        {delState ? (
          <p role="status" className="zq-meta">
            {delState}
          </p>
        ) : null}
      </section>
    </div>
  );
}
