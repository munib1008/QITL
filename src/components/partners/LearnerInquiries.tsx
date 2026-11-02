"use client";

import { useCallback, useEffect, useState } from "react";
import { partnersT } from "@/lib/i18n/modules/partners";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Skeleton } from "@/components/ui/misc";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";
import { AreaField } from "./fields";
import { Pill } from "./shared";

interface Inq {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  learning_partners: { display_name: string; slug: string } | Array<{ display_name: string; slug: string }> | null;
}
interface Message {
  id: string;
  sender_side: string;
  body: string;
  created_at: string;
}

/** A learner's own inquiries and the provider's replies. Reads go through the signed-in client: RLS shows only this learner's rows. */
export function LearnerInquiries({ locale }: { locale: string }) {
  const t = partnersT(locale);
  const [rows, setRows] = useState<Inq[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [feedback, setFeedback] = useState<Msg>(null);

  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return setError(true);
    const { data, error: e } = await sb.from("partner_inquiries").select("id, subject, message, status, created_at, learning_partners(display_name, slug)").order("created_at", { ascending: false }).limit(100);
    if (e) setError(true);
    else setRows((data ?? []) as unknown as Inq[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const loadMsgs = async (id: string) => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { data } = await sb.from("partner_inquiry_messages").select("id, sender_side, body, created_at").eq("inquiry_id", id).order("created_at");
    setMsgs((data ?? []) as Message[]);
  };
  const act = async (fn: () => Promise<unknown>) => {
    setFeedback(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setFeedback({ tone: "err", text: `${t.failedPrefix} ${(e as Error).message}` });
      return false;
    }
  };

  if (error)
    return (
      <p className="zq-error" role="alert">
        {t.loadError}
      </p>
    );
  if (!rows) return <Skeleton height={120} />;
  if (!rows.length) return <p className="zq-meta">{t.learner.empty}</p>;
  return (
    <div className="pt-sec">
      <Feedback msg={feedback} />
      <ul className="pt-list" data-testid="my-inquiries">
        {rows.map((q) => {
          const p = Array.isArray(q.learning_partners) ? q.learning_partners[0] : q.learning_partners;
          return (
            <li key={q.id} className="pt-card">
              <div className="pt-pills">
                <Pill>{t.learner.status[q.status]}</Pill>
              </div>
              <h3 dir="auto">{q.subject}</h3>
              <p className="pt-meta">
                {p?.display_name} · {t.learner.sentOn} {new Date(q.created_at).toLocaleDateString(locale)}
              </p>
              <button
                type="button"
                className="zq-btn"
                aria-expanded={open === q.id}
                onClick={async () => {
                  if (open === q.id) return setOpen(null);
                  setOpen(q.id);
                  await loadMsgs(q.id);
                }}
              >
                {open === q.id ? t.admin.close : t.open}
              </button>
              {open === q.id ? (
                <div className="pt-sec">
                  <p dir="auto" style={{ whiteSpace: "pre-wrap" }}>{q.message}</p>
                  <ul className="pt-thread">
                    {msgs.map((m) => (
                      <li key={m.id} data-side={m.sender_side} dir="auto">
                        <span className="pt-meta">{m.sender_side === "partner" ? t.learner.provider : t.learner.you}</span>
                        <br />
                        {m.body}
                      </li>
                    ))}
                  </ul>
                  {["closed", "spam"].includes(q.status) ? (
                    <p className="zq-meta">{t.learner.closed}</p>
                  ) : (
                    <>
                      <AreaField id={`lr-${q.id}`} label={t.learner.reply} value={reply} onChange={setReply} rows={3} maxLength={2000} />
                      <div className="pt-actions">
                        <button
                          type="button"
                          className="zq-btn zq-btn-primary"
                          disabled={!reply.trim()}
                          onClick={async () => {
                            if (await act(() => apiCall(`/api/partners/inquiries/${q.id}/messages`, "POST", { body: reply }))) {
                              setReply("");
                              await loadMsgs(q.id);
                            }
                          }}
                        >
                          {t.learner.send}
                        </button>
                        <button
                          type="button"
                          className="zq-btn"
                          onClick={async () => {
                            if (await act(() => apiCall(`/api/partners/inquiries/${q.id}`, "PATCH", { status: "closed" }))) await load();
                          }}
                        >
                          {t.learner.close}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
