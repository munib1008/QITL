"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dreamsT } from "@/lib/i18n/modules/dreams";
import { RETENTION_DAYS } from "@/lib/dreams";
import { Skeleton } from "@/components/ui/misc";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";
import { Pill } from "@/components/mufti/ui";

interface Row {
  id: string;
  status: string;
  language: string;
  created_at: string;
  retain_until: string;
}

/** Download a POST response as a file without putting anything in the URL. */
export async function downloadExport(url: string, fallbackName: string) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store" });
  if (!r.ok) {
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error ?? `Request failed (${r.status})`);
  }
  const name = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const href = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/** The submitter's requests, retention preference and data export. */
export function MyDreamRequests({ locale, compact = false }: { locale: string; compact?: boolean }) {
  const t = dreamsT(locale);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [days, setDays] = useState<number>(90);
  const [msg, setMsg] = useState<Msg>(null);
  useEffect(() => {
    apiCall<{ requests: Row[] }>("/api/dreams", "GET")
      .then((d) => setRows(d.requests))
      .catch(() => setError(true));
    if (!compact)
      apiCall<{ retentionDays: number }>("/api/dreams/preferences", "GET")
        .then((d) => setDays(d.retentionDays))
        .catch(() => undefined);
  }, [compact]);

  return (
    <div className="qa">
      <section className="qa-sec" aria-labelledby="my-dreams-h">
        <h2 id="my-dreams-h">{t.mine.title}</h2>
        {error ? (
          <p className="zq-error" role="alert">
            {t.mine.error}
          </p>
        ) : !rows ? (
          <Skeleton height={18} />
        ) : !rows.length ? (
          <p className="zq-meta">{t.mine.empty}</p>
        ) : (
          <ul className="qa-list">
            {rows.map((r) => (
              <li key={r.id} className="qa-card">
                <Link className="title" href={`/dreams/my/${r.id}`}>
                  {t.mine.submitted} {new Date(r.created_at).toLocaleDateString(locale)}
                </Link>
                <div className="qa-meta">
                  <Pill>{t.status[r.status] ?? r.status}</Pill>
                  <span>
                    {t.mine.deletesOn} {new Date(r.retain_until).toLocaleDateString(locale)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link className="zq-btn zq-btn-secondary" href="/dreams/request">
            {t.mine.newRequest}
          </Link>
        </p>
      </section>
      {compact ? null : (
        <section className="qa-card qa-sec" aria-labelledby="dream-privacy-h">
          <h2 id="dream-privacy-h">{t.mine.privacy}</h2>
          <form
            className="qa-actions"
            style={{ alignItems: "flex-end" }}
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg(null);
              try {
                await apiCall("/api/dreams/preferences", "POST", { retentionDays: days });
                setMsg({ tone: "ok", text: t.mine.prefsSaved });
              } catch (err) {
                setMsg({ tone: "err", text: (err as Error).message });
              }
            }}
          >
            <div className="zq-field" style={{ flex: "1 1 200px" }}>
              <label htmlFor="dr-ret">{t.mine.retentionLabel}</label>
              <select id="dr-ret" className="zq-input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {RETENTION_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {t.mine.retentionOptions[d]}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="zq-btn zq-btn-secondary">
              {t.mine.savePrefs}
            </button>
          </form>
          <p className="zq-meta">{t.mine.exportHelp}</p>
          <div className="qa-actions">
            <button
              type="button"
              className="zq-btn zq-btn-secondary"
              onClick={() => downloadExport("/api/dreams/export", "qitl-dreams.json").catch((err: Error) => setMsg({ tone: "err", text: err.message }))}
            >
              {t.mine.export}
            </button>
          </div>
          <Feedback msg={msg} />
        </section>
      )}
    </div>
  );
}
