"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "./useSession";
import { accountStrings } from "@/lib/i18n/modules/account";
import { useLocale } from "@/lib/i18n/useLocale";

/**
 * Records how far a signed-in reader got in a chapter (by scroll position, saved at most every 5 seconds and on
 * leaving the page). Shows the saved percentage; nothing is tracked for signed-out readers.
 */
export function ChapterProgress({ chapterId, elementId }: { chapterId: string; /** the chapter's element when a page holds several chapters */ elementId?: string }) {
  const session = useSession();
  const t = accountStrings(useLocale());
  const [saved, setSaved] = useState<number | null>(null);
  const best = useRef(0);
  const sent = useRef(0);

  useEffect(() => {
    if (session.status !== "signed_in") return;
    const article = (elementId ? document.getElementById(elementId) : null) ?? document.querySelector("article");
    const measure = () => {
      if (!article) return 0;
      const r = article.getBoundingClientRect();
      const seen = Math.min(Math.max(window.innerHeight - r.top, 0), r.height);
      return Math.round((seen / Math.max(r.height, 1)) * 100);
    };
    const send = (keepalive = false) => {
      if (best.current <= sent.current) return;
      const percent = best.current;
      sent.current = percent;
      fetch("/api/me/progress", { method: "PATCH", keepalive, headers: { "content-type": "application/json" }, body: JSON.stringify({ chapterId, percent }) })
        .then((r) => (r.ok ? setSaved(percent) : undefined))
        .catch(() => {
          sent.current = 0; // retry on the next tick
        });
    };
    const onScroll = () => {
      best.current = Math.max(best.current, measure());
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const t = setInterval(() => send(), 5000);
    const onHide = () => send(true);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      clearInterval(t);
      send(true);
    };
  }, [session.status, chapterId, elementId]);

  if (session.status !== "signed_in") return null;
  return (
    <p className="zq-meta" aria-live="polite" style={{ marginTop: 24 }}>
      {saved == null ? t.progressIdle : saved >= 100 ? t.progressDone : t.progressSaved(saved)}
    </p>
  );
}
