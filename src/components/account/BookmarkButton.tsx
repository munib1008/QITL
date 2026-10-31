"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { decodeIntent, encodeIntent, type BookmarkTarget } from "@/lib/validation";
import { stripLocale } from "@/lib/i18n";
import { useSession } from "./useSession";
import { accountStrings } from "@/lib/i18n/modules/account";
import { useLocale } from "@/lib/i18n/useLocale";

type Saved = "unknown" | "saved" | "not_saved";

/** One request per page for the reader's saved bookmarks, shared by every button (a surah has hundreds). */
let savedPromise: Promise<Set<string>> | null = null;
function savedKeys(): Promise<Set<string>> {
  savedPromise ??= fetch("/api/me/bookmarks", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: { bookmarks: Array<{ target_type: string; target_id: string }> }) => new Set(d.bookmarks.map((b) => `${b.target_type}:${b.target_id}`)))
    .catch((e) => {
      savedPromise = null;
      throw e;
    });
  return savedPromise;
}

/**
 * Bookmark toggle. Signed out: goes to sign-in carrying returnTo and the intent; after sign-in the page asks the
 * user to confirm before anything is saved. Signed in: persists through /api/me/bookmarks, ignores repeat clicks
 * while a request is in flight, and rolls back with a visible error if the server refuses.
 */
function BookmarkButtonInner({ target, variant = "button" }: { target: BookmarkTarget; variant?: "button" | "icon" }) {
  const session = useSession();
  const t = accountStrings(useLocale());
  const router = useRouter();
  const params = useSearchParams();
  const [saved, setSaved] = useState<Saved>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const busy = useRef(false);
  const cls = variant === "icon" ? "zq-iconbtn" : "zq-btn zq-btn-secondary";
  const key = encodeIntent({ action: "bookmark", target });

  useEffect(() => {
    if (session.status !== "signed_in") return;
    savedKeys()
      .then((keys) => setSaved(keys.has(`${target.type}:${target.id}`) ? "saved" : "not_saved"))
      .catch(() => setSaved("unknown"));
  }, [session.status, target.type, target.id]);

  // Returning from sign-in with this bookmark as the pending intent: ask before saving.
  useEffect(() => {
    if (session.status !== "signed_in") return;
    const intent = decodeIntent(params.get("intent"));
    if (intent && encodeIntent(intent) === key && saved === "not_saved") setConfirming(true);
  }, [session.status, params, key, saved]);

  const clearIntent = useCallback(() => {
    const p = new URLSearchParams(params.toString());
    p.delete("intent");
    const path = stripLocale(window.location.pathname);
    router.replace(p.size ? `${path}?${p}` : path, { scroll: false });
  }, [params, router]);

  const toggle = async (want: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    const before = saved;
    setSaved(want ? "saved" : "not_saved");
    try {
      const res = await fetch("/api/me/bookmarks", {
        method: want ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(target),
      });
      if (!res.ok) throw new Error(res.status === 401 ? t.sessionEnded : t.couldNotSave);
      savedPromise = null;
    } catch (e) {
      setSaved(before);
      setError(e instanceof Error ? e.message : t.couldNotSave);
    } finally {
      busy.current = false;
    }
  };

  if (session.status === "loading")
    return (
      <button type="button" className={cls} disabled aria-busy="true">
        <Icon.bookmark />
        {t.bookmark}
      </button>
    );
  if (session.status === "unavailable")
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <button type="button" className={cls} disabled aria-describedby={`bm-na-${target.id}`}>
          <Icon.bookmark />
          {t.bookmark}
        </button>
        <span id={`bm-na-${target.id}`} className="zq-soon">
          {t.accountsSoon}
        </span>
      </span>
    );
  if (session.status === "signed_out")
    return (
      <button
        type="button"
        className={cls}
        onClick={() => {
          const returnTo = stripLocale(window.location.pathname) + window.location.search;
          router.push(`/sign-in?${new URLSearchParams({ returnTo, intent: key })}`);
        }}
      >
        <Icon.bookmark />
        {t.bookmark}
      </button>
    );

  if (confirming)
    return (
      <span role="group" aria-label={t.confirmBookmark} style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span className="zq-meta">{t.saveThis}</span>
        <button
          type="button"
          className="zq-btn zq-btn-primary zq-btn-sm"
          onClick={async () => {
            setConfirming(false);
            await toggle(true);
            clearIntent();
          }}
        >
          {t.saveBookmark}
        </button>
        <button
          type="button"
          className="zq-btn zq-btn-quiet zq-btn-sm"
          onClick={() => {
            setConfirming(false);
            clearIntent();
          }}
        >
          {t.notNow}
        </button>
      </span>
    );

  const on = saved === "saved";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button type="button" className={cls} aria-pressed={on} disabled={saved === "unknown" && !error} onClick={() => toggle(!on)}>
        {on ? <Icon.bookmarked /> : <Icon.bookmark />}
        {on ? t.bookmarkSaved : t.bookmark}
      </button>
      {error ? (
        <span role="alert" className="zq-error">
          <Icon.alert />
          {error}
        </span>
      ) : null}
    </span>
  );
}

export function BookmarkButton(props: { target: BookmarkTarget; variant?: "button" | "icon" }) {
  const t = accountStrings(useLocale());
  const cls = props.variant === "icon" ? "zq-iconbtn" : "zq-btn zq-btn-secondary";
  return (
    <Suspense
      fallback={
        <button type="button" className={cls} disabled aria-busy="true">
          <Icon.bookmark />
          {t.bookmark}
        </button>
      }
    >
      <BookmarkButtonInner {...props} />
    </Suspense>
  );
}
