"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { Skeleton } from "@/components/ui/misc";
import { apiCall, Feedback, type Msg } from "./api";
import { Pill, VerifiedBadge } from "./ui";

interface Profile {
  user_id: string;
  display_name: string;
  madhhab: string | null;
  credentials_md: string;
  verified_at: string | null;
  verification_note: string | null;
  dream_qualified_at: string | null;
}
interface Question {
  id: string;
  title: string;
  body: string;
  visibility: string;
  status: string;
  topic_type: string | null;
  topic_ref: string | null;
  created_at: string;
  mufti_assignments?: Array<{ mufti_id: string }>;
}

/**
 * Admin and moderator tools for Mufti Q&A: verify mufti profiles (and the separate dream qualification), moderate
 * questions, and assign verified muftis. Reads go through RLS as the signed-in staff member; writes go through the
 * API routes, which check the role again.
 */
export function AdminMufti({ locale }: { locale: string }) {
  const t = muftiT(locale);
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [roleHolders, setRoleHolders] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Question[] | null>(null);
  const [open, setOpen] = useState<Question[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const [p, r, q, o] = await Promise.all([
      sb.from("mufti_profiles").select("user_id, display_name, madhhab, credentials_md, verified_at, verification_note, dream_qualified_at").order("created_at"),
      sb.from("role_assignments").select("user_id").eq("role", "mufti"),
      sb.from("mufti_questions").select("id, title, body, visibility, status, topic_type, topic_ref, created_at").eq("status", "submitted").order("created_at").limit(100),
      sb.from("mufti_questions").select("id, title, body, visibility, status, topic_type, topic_ref, created_at, mufti_assignments(mufti_id)").in("status", ["accepted", "assigned"]).order("created_at").limit(100),
    ]);
    setProfiles((p.data as Profile[] | null) ?? []);
    setRoleHolders(new Set(((r.data as Array<{ user_id: string }> | null) ?? []).map((x) => x.user_id)));
    setPending((q.data as Question[] | null) ?? []);
    setOpen((o.data as Question[] | null) ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (url: string, body: unknown) => {
    setMsg(null);
    try {
      await apiCall(url, "POST", body);
      setMsg({ tone: "ok", text: t.admin.done });
      await load();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    }
  };
  const ask = (label: string) => (typeof window === "undefined" ? "" : (window.prompt(label) ?? "").trim());
  const verified = (profiles ?? []).filter((p) => p.verified_at && roleHolders.has(p.user_id));
  const nameOf = (id: string) => profiles?.find((p) => p.user_id === id)?.display_name ?? id.slice(0, 8);

  return (
    <div className="qa">
      <Feedback msg={msg} />

      <section className="qa-sec" aria-labelledby="am-mod-h">
        <h2 id="am-mod-h">{t.admin.moderation}</h2>
        {!pending ? (
          <Skeleton height={20} />
        ) : !pending.length ? (
          <p className="zq-meta">{t.admin.noModeration}</p>
        ) : (
          <ul className="qa-list">
            {pending.map((q) => (
              <li key={q.id} className="qa-card">
                <b>{q.title}</b>
                <div className="qa-meta">
                  <Pill>{t.visibility[q.visibility]}</Pill>
                  {q.topic_type ? <Pill>{t.ask.topics[q.topic_type] ?? q.topic_type}</Pill> : null}
                  {q.topic_ref ? <span dir="ltr">{q.topic_ref}</span> : null}
                  <span>{new Date(q.created_at).toLocaleDateString(locale)}</span>
                </div>
                <div className="qa-quote">{q.body}</div>
                <div className="qa-actions">
                  <button type="button" className="zq-btn zq-btn-primary" onClick={() => act("/api/admin/mufti/questions", { questionId: q.id, action: "accept" })}>
                    {t.admin.accept}
                  </button>
                  <button
                    type="button"
                    className="zq-btn zq-btn-secondary"
                    onClick={() => {
                      const note = ask(t.admin.moderationNote);
                      void act("/api/admin/mufti/questions", { questionId: q.id, action: "reject", ...(note ? { note } : {}) });
                    }}
                  >
                    {t.admin.reject}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="qa-sec" aria-labelledby="am-assign-h">
        <h2 id="am-assign-h">{t.admin.assign}</h2>
        {!open ? (
          <Skeleton height={20} />
        ) : !open.length ? (
          <p className="zq-meta">{t.admin.noOpen}</p>
        ) : (
          <ul className="qa-list">
            {open.map((q) => {
              const assigned = new Set((q.mufti_assignments ?? []).map((a) => a.mufti_id));
              return (
                <li key={q.id} className="qa-card">
                  <b>{q.title}</b>
                  <div className="qa-meta">
                    <Pill>{t.status[q.status]}</Pill>
                    <Pill>{t.visibility[q.visibility]}</Pill>
                    {[...assigned].map((id) => (
                      <span key={id} className="qa-actions">
                        <Pill>{nameOf(id)}</Pill>
                        <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => act("/api/admin/mufti/assign", { questionId: q.id, muftiId: id, assign: false })}>
                          {t.composer.remove}
                        </button>
                      </span>
                    ))}
                  </div>
                  {verified.filter((p) => !assigned.has(p.user_id)).length ? (
                    <form
                      className="qa-actions"
                      style={{ alignItems: "flex-end" }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void act("/api/admin/mufti/assign", { questionId: q.id, muftiId: String(f.get("mufti")) });
                      }}
                    >
                      <div className="zq-field" style={{ flex: "1 1 200px" }}>
                        <label htmlFor={`as-${q.id}`}>{t.admin.assignTo}</label>
                        <select id={`as-${q.id}`} name="mufti" className="zq-input" required>
                          {verified
                            .filter((p) => !assigned.has(p.user_id))
                            .map((p) => (
                              <option key={p.user_id} value={p.user_id}>
                                {p.display_name}
                              </option>
                            ))}
                        </select>
                      </div>
                      <button type="submit" className="zq-btn zq-btn-primary">
                        {t.admin.assignButton}
                      </button>
                      <button type="button" className="zq-btn zq-btn-quiet" onClick={() => act("/api/admin/mufti/questions", { questionId: q.id, action: "close" })}>
                        {t.admin.close}
                      </button>
                    </form>
                  ) : (
                    <p className="zq-meta">{t.admin.noVerified}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="qa-sec" aria-labelledby="am-prof-h">
        <h2 id="am-prof-h">{t.admin.profiles}</h2>
        {!profiles ? (
          <Skeleton height={20} />
        ) : !profiles.length ? (
          <p className="zq-meta">{t.admin.noProfiles}</p>
        ) : (
          <ul className="qa-list">
            {profiles.map((p) => (
              <li key={p.user_id} className="qa-card">
                <div className="qa-actions">
                  <b>{p.display_name}</b>
                  {p.verified_at ? <VerifiedBadge>{t.question.verified}</VerifiedBadge> : <Pill>{t.workspace.profilePending}</Pill>}
                  {p.dream_qualified_at ? <Pill>{t.workspace.dreamQualified}</Pill> : null}
                  <Pill>{roleHolders.has(p.user_id) ? t.admin.hasRole : t.admin.noRole}</Pill>
                  {p.madhhab ? <Pill>{t.workspace.madhhabs[p.madhhab]}</Pill> : null}
                </div>
                <div className="qa-quote">{p.credentials_md}</div>
                {p.verification_note ? <p className="zq-meta">{p.verification_note}</p> : null}
                <div className="qa-actions">
                  {!roleHolders.has(p.user_id) ? (
                    <button type="button" className="zq-btn zq-btn-secondary" onClick={() => act("/api/admin/mufti/verify", { userId: p.user_id, action: "grant_role" })}>
                      {t.admin.grantRole}
                    </button>
                  ) : null}
                  {p.verified_at ? (
                    <button type="button" className="zq-btn zq-btn-quiet" onClick={() => act("/api/admin/mufti/verify", { userId: p.user_id, action: "unverify" })}>
                      {t.admin.unverify}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="zq-btn zq-btn-primary"
                      onClick={() => {
                        const note = ask(t.admin.verificationNote);
                        if (note) void act("/api/admin/mufti/verify", { userId: p.user_id, action: "verify", note });
                      }}
                    >
                      {t.admin.verify}
                    </button>
                  )}
                  {p.verified_at && !p.dream_qualified_at ? (
                    <button
                      type="button"
                      className="zq-btn zq-btn-secondary"
                      onClick={() => {
                        const note = ask(t.admin.dreamNote);
                        if (note) void act("/api/admin/mufti/verify", { userId: p.user_id, action: "dream_qualify", note });
                      }}
                    >
                      {t.admin.dreamGrant}
                    </button>
                  ) : null}
                  {p.dream_qualified_at ? (
                    <button type="button" className="zq-btn zq-btn-quiet" onClick={() => act("/api/admin/mufti/verify", { userId: p.user_id, action: "dream_unqualify" })}>
                      {t.admin.dreamRevoke}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
