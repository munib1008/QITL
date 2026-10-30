"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BookmarkTarget } from "@/lib/validation";
import { useSession } from "./useSession";

type Status = "idle" | "loading" | "saving" | "saved" | "error";

/**
 * A private note on a page. Private by design (only the owner can read it, enforced by RLS).
 * Autosaves 1 second after typing stops, shows its state, warns before leaving with unsaved text,
 * and keeps the text in the box if a save fails so nothing is lost silently.
 */
export function NoteEditor({ target }: { target: BookmarkTarget }) {
  const session = useSession();
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (session.status !== "signed_in") return;
    fetch(`/api/me/notes?${new URLSearchParams({ type: target.type, id: target.id })}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { note: { body: string } | null }) => {
        setBody(d.note?.body ?? "");
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  }, [session.status, target.type, target.id]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const save = async (text: string) => {
    setStatus("saving");
    try {
      const r = await fetch("/api/me/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ target, body: text }) });
      if (!r.ok) throw new Error();
      dirty.current = false;
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  if (session.status === "loading") return null;
  if (session.status === "unavailable")
    return (
      <div className="pp-card">
        <h3>Private note</h3>
        <p className="zq-meta" style={{ margin: 0 }}>
          Notes need an account, and accounts are not open on this site yet.
        </p>
      </div>
    );
  if (session.status === "signed_out")
    return (
      <div className="pp-card">
        <h3>Private note</h3>
        <p className="zq-meta" style={{ margin: 0 }}>
          <Link href={`/sign-in?returnTo=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname + window.location.search)}`}>Sign in</Link> to keep private notes. Only you can read them.
        </p>
      </div>
    );

  const id = `note-${target.type}-${target.id}`;
  return (
    <div className="pp-card">
      <h3>
        <label htmlFor={id}>Private note</label>
      </h3>
      <textarea
        id={id}
        className="zq-textarea"
        value={body}
        disabled={status === "loading"}
        maxLength={20000}
        aria-describedby={`${id}-s`}
        onChange={(e) => {
          const v = e.target.value;
          setBody(v);
          dirty.current = true;
          setStatus("idle");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void save(v), 1000);
        }}
        onBlur={() => {
          if (dirty.current) void save(body);
        }}
      />
      <p id={`${id}-s`} className={status === "error" ? "zq-error" : "zq-help"} role="status" style={{ margin: 0 }}>
        {status === "loading" ? "Loading…" : status === "saving" ? "Saving…" : status === "saved" ? "Saved. Only you can read this note." : status === "error" ? "Not saved. Your text is still here." : "Only you can read this note."}
        {status === "error" ? (
          <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => void save(body)} style={{ marginInlineStart: 8 }}>
            Retry
          </button>
        ) : null}
      </p>
    </div>
  );
}
