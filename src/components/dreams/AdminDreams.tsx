"use client";

import { useCallback, useEffect, useState } from "react";
import { dreamsT } from "@/lib/i18n/modules/dreams";
import { DREAM_REASONS } from "@/lib/dreams";
import { Skeleton } from "@/components/ui/misc";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";
import { Pill } from "@/components/mufti/ui";

interface QueueRow {
  id: string;
  status: string;
  language: string;
  created_at: string;
  retain_until: string;
  scholar_access: boolean;
  second_opinion_consent: boolean;
  open_second_opinion: string | null;
  assignees: Array<{ scholar_id: string; role: string; assigned_at: string }>;
}
interface Scholar {
  user_id: string;
  display_name: string;
}

/** Administrator queue for dream requests. Metadata only: the dream text never reaches this screen. */
export function AdminDreams({ locale }: { locale: string }) {
  const t = dreamsT(locale);
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const load = useCallback(async () => {
    try {
      const d = await apiCall<{ queue: QueueRow[]; scholars: Scholar[] }>("/api/admin/dreams", "GET");
      setRows(d.queue);
      setScholars(d.scholars);
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
      setRows([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (body: unknown) => {
    setMsg(null);
    try {
      await apiCall("/api/admin/dreams", "POST", body);
      setMsg({ tone: "ok", text: t.admin.done });
      await load();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    }
  };
  const nameOf = (id: string) => scholars.find((s) => s.user_id === id)?.display_name ?? id.slice(0, 8);

  return (
    <div className="qa">
      <p className="qa-notice">{t.admin.lead}</p>
      <Feedback msg={msg} />
      {!rows ? (
        <Skeleton height={20} />
      ) : !rows.length ? (
        <p className="zq-meta">{t.admin.empty}</p>
      ) : (
        <ul className="qa-list">
          {rows.map((r) => {
            const taken = new Set(r.assignees.map((a) => a.scholar_id));
            const free = scholars.filter((s) => !taken.has(s.user_id));
            return (
              <li key={r.id} className="qa-card">
                <div className="qa-actions">
                  <b>
                    {t.admin.request} <span dir="ltr">{r.id.slice(0, 8)}</span>
                  </b>
                  <Pill>{t.status[r.status] ?? r.status}</Pill>
                  <Pill>
                    {t.admin.language}: {r.language}
                  </Pill>
                  <Pill>{r.scholar_access ? t.admin.consentYes : t.admin.consentNo}</Pill>
                  {r.open_second_opinion ? <Pill>{t.admin.secondWaiting}</Pill> : null}
                </div>
                <div className="qa-meta">
                  <span>{new Date(r.created_at).toLocaleDateString(locale)}</span>
                  <span>
                    {t.mine.deletesOn} {new Date(r.retain_until).toLocaleDateString(locale)}
                  </span>
                </div>
                {r.assignees.length ? (
                  <div className="qa-actions">
                    <span className="zq-meta">{t.admin.assignees}:</span>
                    {r.assignees.map((a) => (
                      <span key={a.scholar_id} className="qa-actions">
                        <Pill>
                          {nameOf(a.scholar_id)} · {t.scholar.roles[a.role] ?? a.role}
                        </Pill>
                        <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => act({ action: "unassign", requestId: r.id, scholarId: a.scholar_id })}>
                          ×<span className="sr-only">{nameOf(a.scholar_id)}</span>
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {r.scholar_access && (r.status === "submitted" || r.status === "assigned" || r.open_second_opinion) ? (
                  free.length ? (
                    <form
                      className="qa-actions"
                      style={{ alignItems: "flex-end" }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void act({ action: "assign", requestId: r.id, scholarId: String(f.get("scholar")), role: String(f.get("role")) });
                      }}
                    >
                      <div className="zq-field" style={{ flex: "1 1 180px" }}>
                        <label htmlFor={`da-s-${r.id}`}>{t.admin.assignTo}</label>
                        <select id={`da-s-${r.id}`} name="scholar" className="zq-input">
                          {free.map((s) => (
                            <option key={s.user_id} value={s.user_id}>
                              {s.display_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="zq-field" style={{ flex: "1 1 160px" }}>
                        <label htmlFor={`da-r-${r.id}`}>{t.admin.role}</label>
                        <select id={`da-r-${r.id}`} name="role" className="zq-input" defaultValue={r.open_second_opinion ? "second_opinion" : "primary"}>
                          {["primary", "reviewer", "second_opinion"].map((k) => (
                            <option key={k} value={k}>
                              {t.scholar.roles[k]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" className="zq-btn zq-btn-primary">
                        {t.admin.assign}
                      </button>
                    </form>
                  ) : (
                    <p className="zq-meta">{t.admin.noScholars}</p>
                  )
                ) : null}
                {r.status !== "declined" && r.status !== "closed" ? (
                  <form
                    className="qa-actions"
                    style={{ alignItems: "flex-end" }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act({ action: "status", requestId: r.id, status: r.status === "answered" ? "closed" : "declined", reason: String(f.get("reason")) });
                    }}
                  >
                    <div className="zq-field" style={{ flex: "1 1 200px" }}>
                      <label htmlFor={`da-x-${r.id}`}>{t.admin.reason}</label>
                      <select id={`da-x-${r.id}`} name="reason" className="zq-input" defaultValue={r.status === "answered" ? "completed" : "capacity"}>
                        {DREAM_REASONS.map((k) => (
                          <option key={k} value={k}>
                            {t.reasons[k]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="zq-btn zq-btn-secondary">
                      {r.status === "answered" ? t.admin.close : t.admin.decline}
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
