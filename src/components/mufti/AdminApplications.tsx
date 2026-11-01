"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { muftiApplyT } from "@/lib/i18n/modules/muftiApply";
import { Skeleton } from "@/components/ui/misc";
import { apiCall, Feedback, type Msg } from "./api";
import { Pill } from "./ui";

interface App {
  id: string;
  applicant_name: string;
  credentials_md: string;
  madhhab: string | null;
  field: string | null;
  links: string[];
  status: string;
  decision_note: string | null;
  created_at: string;
}

const STATUSES = ["submitted", "under_review", "verified", "declined"] as const;

/**
 * Scholar applications for staff. Moderators and administrators read them (RLS); only an administrator can move one,
 * and moving one never grants a role or verifies a profile. Those stay the actions under Profiles on this page.
 */
export function AdminApplications({ locale }: { locale: string }) {
  const t = muftiApplyT(locale);
  const m = muftiT(locale);
  const [rows, setRows] = useState<App[] | null>(null);
  const [error, setError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState<string>("open");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const [r, a] = await Promise.all([
      sb
        .from("mufti_applications")
        .select("id, applicant_name, credentials_md, madhhab, field, links, status, decision_note, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      sb.rpc("has_role", { r: "admin" }),
    ]);
    if (r.error) setError(true);
    else setRows((r.data as App[] | null) ?? []);
    setIsAdmin(a.data === true);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const move = async (id: string, status: "under_review" | "verified" | "declined") => {
    setMsg(null);
    try {
      await apiCall("/api/admin/mufti/applications", "POST", { id, status, ...(notes[id]?.trim() ? { note: notes[id]!.trim() } : {}) });
      setMsg({ tone: "ok", text: t.admin.done });
      await load();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    }
  };

  const shown = (rows ?? []).filter((r) => (filter === "all" ? true : filter === "open" ? r.status === "submitted" || r.status === "under_review" : r.status === filter));

  return (
    <section className="qa-sec" aria-labelledby="am-apps-h" data-testid="admin-applications">
      <h2 id="am-apps-h">{t.admin.title}</h2>
      <p className="zq-meta">{t.admin.lead}</p>
      {!isAdmin && rows ? <p className="qa-notice">{t.admin.adminsOnly}</p> : null}
      <div className="zq-field" style={{ maxWidth: 280 }}>
        <label htmlFor="am-apps-filter">{t.admin.filter}</label>
        <select id="am-apps-filter" className="zq-input" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">{t.status.submitted} / {t.status.under_review}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.status[s]}
            </option>
          ))}
          <option value="all">{t.admin.all}</option>
        </select>
      </div>
      <Feedback msg={msg} />
      {error ? (
        <p className="zq-error" role="alert">
          {t.admin.loadError}
        </p>
      ) : !rows ? (
        <Skeleton height={20} />
      ) : !shown.length ? (
        <p className="zq-meta">{t.admin.empty}</p>
      ) : (
        <ul className="qa-list">
          {shown.map((a) => (
            <li key={a.id} className="qa-card" data-testid="application">
              <div className="qa-actions">
                <b>{a.applicant_name}</b>
                <Pill>{t.status[a.status] ?? a.status}</Pill>
                {a.madhhab ? <Pill>{m.workspace.madhhabs[a.madhhab]}</Pill> : null}
                <span className="zq-meta">{new Date(a.created_at).toLocaleDateString(locale)}</span>
              </div>
              {a.field ? (
                <p className="zq-meta">
                  {t.admin.field}: {a.field}
                </p>
              ) : null}
              <div className="qa-quote">{a.credentials_md}</div>
              {a.links.length ? (
                <div>
                  <b>{t.admin.links}</b>
                  <ul className="qa-limits">
                    {a.links.map((l) => (
                      <li key={l} dir="ltr">
                        {l.startsWith("https://") ? (
                          <a href={l} rel="noopener noreferrer nofollow" target="_blank">
                            {l}
                          </a>
                        ) : (
                          l
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {a.decision_note ? <p className="zq-meta">{a.decision_note}</p> : null}
              {isAdmin && a.status === "submitted" ? (
                <div className="qa-actions">
                  <button type="button" className="zq-btn zq-btn-primary" onClick={() => move(a.id, "under_review")}>
                    {t.admin.startReview}
                  </button>
                </div>
              ) : null}
              {isAdmin && a.status === "under_review" ? (
                <>
                  <div className="zq-field">
                    <label htmlFor={`ap-note-${a.id}`}>{t.admin.notePrompt}</label>
                    <textarea
                      id={`ap-note-${a.id}`}
                      className="zq-textarea"
                      rows={3}
                      maxLength={1000}
                      value={notes[a.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                    />
                  </div>
                  <div className="qa-actions">
                    <button type="button" className="zq-btn zq-btn-primary" disabled={(notes[a.id] ?? "").trim().length < 4} onClick={() => move(a.id, "verified")}>
                      {t.admin.verify}
                    </button>
                    <button type="button" className="zq-btn zq-btn-secondary" disabled={(notes[a.id] ?? "").trim().length < 4} onClick={() => move(a.id, "declined")}>
                      {t.admin.decline}
                    </button>
                  </div>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
