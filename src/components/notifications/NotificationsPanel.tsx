"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import "@/styles/notifications.css";
import "@/styles/qa.css";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { notificationsT } from "@/lib/i18n/modules/notifications";
import { Skeleton } from "@/components/ui/misc";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";
import { NOTIFICATIONS_CHANGED } from "./NotificationBell";

interface Row {
  id: string;
  kind: string;
  title: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

/** "Notifications" on My library: the reader's own in-app notifications (a kind, a title and a link), newest first. */
export function NotificationsPanel({ locale }: { locale: string }) {
  const t = notificationsT(locale);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { data, error: e } = await sb
      .from("notifications")
      .select("id, kind, title, link, created_at, read_at")
      .eq("channel", "in_app")
      .order("created_at", { ascending: false })
      .limit(50);
    if (e) setError(true);
    else setRows((data as Row[] | null) ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const mark = async (body: { ids: string[] } | { all: true }) => {
    setBusy(true);
    setMsg(null);
    try {
      await apiCall("/api/notifications", "POST", body);
      await load();
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const unread = (rows ?? []).filter((r) => !r.read_at).length;

  return (
    <section className="qa qa-sec" id="notifications" aria-labelledby="notifications-h">
      <h2 id="notifications-h">{t.panel.title}</h2>
      <p className="zq-meta">{t.panel.lead}</p>
      {error ? (
        <p className="zq-error" role="alert">
          {t.panel.loadError}
        </p>
      ) : !rows ? (
        <Skeleton height={18} />
      ) : !rows.length ? (
        <p className="zq-meta">{t.panel.empty}</p>
      ) : (
        <>
          <div className="nt-actions">
            <span className="zq-meta" role="status">
              {t.panel.unreadCount(unread)}
            </span>
            {unread > 0 ? (
              <button type="button" className="zq-btn zq-btn-secondary" disabled={busy} onClick={() => mark({ all: true })}>
                {busy ? t.panel.working : t.panel.markAll}
              </button>
            ) : null}
          </div>
          <Feedback msg={msg} />
          <ul className="nt-list">
            {rows.map((r) => (
              <li key={r.id} className="nt-item" data-unread={!r.read_at}>
                <span className="nt-head">{t.kinds[r.kind] ?? t.kinds.system}</span>
                {r.title ? <span className="nt-title">{r.title}</span> : null}
                <div className="nt-meta">
                  <span>{r.read_at ? t.panel.read : t.panel.unread}</span>
                  <span>{new Date(r.created_at).toLocaleDateString(locale)}</span>
                </div>
                <div className="nt-actions">
                  {r.link ? (
                    <Link className="zq-btn zq-btn-primary" href={r.link} onClick={() => (r.read_at ? undefined : void mark({ ids: [r.id] }))}>
                      {t.panel.open}
                    </Link>
                  ) : null}
                  {!r.read_at ? (
                    <button type="button" className="zq-btn zq-btn-quiet" disabled={busy} onClick={() => mark({ ids: [r.id] })}>
                      {t.panel.markOne}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
