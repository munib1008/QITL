"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import "@/styles/notifications.css";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { notificationsT } from "@/lib/i18n/modules/notifications";
import { useLocale } from "@/lib/i18n/useLocale";

/** Same-tab signal: the panel marks notifications read and tells the bell to recount. */
export const NOTIFICATIONS_CHANGED = "qitl:notifications-changed";

/**
 * A bell with the unread count for the signed-in reader, shown next to the account link. It reads only a count of the
 * reader's own unread in-app rows (RLS: own rows only) and links to the panel on My library. Nothing about the
 * notifications is put in the page title or announced beyond the count.
 */
export function NotificationBell() {
  const t = notificationsT(useLocale()).bell;
  const [n, setN] = useState(0);
  const count = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { count: c, error } = await sb.from("notifications").select("id", { count: "exact", head: true }).eq("channel", "in_app").is("read_at", null);
    if (!error) setN(c ?? 0);
  }, []);
  useEffect(() => {
    void count();
    const again = () => void count();
    window.addEventListener("focus", again);
    window.addEventListener(NOTIFICATIONS_CHANGED, again);
    return () => {
      window.removeEventListener("focus", again);
      window.removeEventListener(NOTIFICATIONS_CHANGED, again);
    };
  }, [count]);
  return (
    <Link className="zq-btn zq-btn-quiet zq-btn-sm zq-btn-link zq-bell" href="/account#notifications" prefetch={false} aria-label={n > 0 ? t.unread(n) : t.none} data-testid="notification-bell">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" />
        <path d="M10 20a2 2 0 004 0" />
      </svg>
      {n > 0 ? (
        <span className="zq-bell-count" aria-hidden="true" data-testid="notification-count">
          {n > 99 ? "99+" : n}
        </span>
      ) : null}
    </Link>
  );
}
