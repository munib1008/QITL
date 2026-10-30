"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { citationDisplay, type CitationRow } from "@/lib/mufti";
import { apiCall, Feedback, type Msg } from "./api";
import { CitationForm } from "./CitationForm";
import { Pill } from "./ui";

export interface OwnAnswer {
  id: string;
  body_md: string;
  status: string;
  review_status: string;
  review_note: string | null;
  version: number;
  citations: Array<CitationRow & { id: string }>;
}

/** The assigned mufti's composer: write, cite, submit for independent review, publish once approved. */
export function AnswerComposer({ questionId, answer, locale }: { questionId: string; answer: OwnAnswer | null; locale: string }) {
  const t = muftiT(locale);
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "ok", text: t.composer.saved });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (!answer)
    return (
      <form
        className="qa-card qa-sec"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(() => apiCall("/api/mufti/answers", "POST", { questionId, body: String(f.get("body") ?? ""), submit: false }));
        }}
      >
        <h2>{t.composer.title}</h2>
        <div className="zq-field">
          <label htmlFor="ans-body">{t.composer.bodyLabel}</label>
          <textarea id="ans-body" name="body" className="zq-textarea" style={{ minHeight: 240 }} required minLength={20} maxLength={20000} aria-describedby="ans-body-d" />
          <span className="zq-help" id="ans-body-d">
            {t.composer.bodyHelp}
          </span>
        </div>
        <Feedback msg={msg} />
        <div className="qa-actions">
          <button type="submit" className="zq-btn zq-btn-secondary" disabled={busy}>
            {t.composer.saveDraft}
          </button>
        </div>
      </form>
    );

  const canPublish = answer.status === "submitted" && answer.review_status === "approved" && answer.citations.length > 0;
  return (
    <div className="qa-sec">
      <form
        className="qa-card qa-sec"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(() => apiCall(`/api/mufti/answers/${answer.id}`, "PATCH", { body: String(f.get("body") ?? "") }));
        }}
      >
        <h2>{t.composer.title}</h2>
        <div className="qa-meta">
          <Pill>
            {t.composer.status}: {t.composer.statuses[answer.status] ?? answer.status}
          </Pill>
          <Pill>
            {t.composer.review}: {t.composer.reviews[answer.review_status] ?? answer.review_status}
          </Pill>
          <span>v{answer.version}</span>
        </div>
        {answer.review_note ? <p className="qa-notice">{answer.review_note}</p> : null}
        <div className="zq-field">
          <label htmlFor="ans-edit">{t.composer.bodyLabel}</label>
          <textarea id="ans-edit" name="body" className="zq-textarea" style={{ minHeight: 240 }} defaultValue={answer.body_md} required minLength={20} maxLength={20000} aria-describedby="ans-edit-d" />
          <span className="zq-help" id="ans-edit-d">
            {t.composer.editNote}
          </span>
        </div>
        <Feedback msg={msg} />
        <div className="qa-actions">
          <button type="submit" className="zq-btn zq-btn-secondary" disabled={busy}>
            {t.composer.saveDraft}
          </button>
          {answer.status === "draft" || answer.status === "withdrawn" ? (
            <button type="button" className="zq-btn zq-btn-primary" disabled={busy} onClick={() => run(() => apiCall(`/api/mufti/answers/${answer.id}`, "PATCH", { status: "submitted" }))}>
              {t.composer.submit}
            </button>
          ) : null}
          {answer.status !== "published" ? (
            <button type="button" className="zq-btn zq-btn-primary" disabled={busy || !canPublish} onClick={() => run(() => apiCall(`/api/mufti/answers/${answer.id}`, "PATCH", { status: "published" }))}>
              {t.composer.publish}
            </button>
          ) : null}
          {answer.status !== "withdrawn" && answer.status !== "draft" ? (
            <button type="button" className="zq-btn zq-btn-quiet" disabled={busy} onClick={() => run(() => apiCall(`/api/mufti/answers/${answer.id}`, "PATCH", { status: "withdrawn" }))}>
              {t.composer.withdraw}
            </button>
          ) : null}
        </div>
      </form>
      <section className="qa-card qa-sec" aria-labelledby="ans-cites-h">
        <h2 id="ans-cites-h">{t.composer.citations}</h2>
        {answer.citations.length ? (
          <ul className="qa-list">
            {answer.citations.map((c) => (
              <li key={c.id} className="qa-actions">
                <span className="qa-pill">{t.cite[c.kind]}</span>
                <span dir="ltr">{citationDisplay(c).label}</span>
                {c.note ? <span className="zq-meta">{c.note}</span> : null}
                {answer.status !== "published" ? (
                  <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => run(() => apiCall(`/api/mufti/answers/${answer.id}/citations?citationId=${c.id}`, "DELETE"))}>
                    {t.composer.remove}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="zq-meta">{t.question.noCitations}</p>
        )}
        {answer.status !== "published" ? <CitationForm endpoint={`/api/mufti/answers/${answer.id}/citations`} locale={locale} onAdded={() => router.refresh()} idPrefix="ans-cite" /> : null}
      </section>
    </div>
  );
}
