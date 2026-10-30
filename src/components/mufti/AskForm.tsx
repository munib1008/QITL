"use client";

import Link from "next/link";
import { useState } from "react";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { QUESTION_TOPICS } from "@/lib/mufti";
import { apiCall, Feedback, type Msg } from "./api";

/** Ask a question (signed in). Public or private; a moderator reads every question before anyone else sees it. */
export function AskForm({ locale }: { locale: string }) {
  const t = muftiT(locale);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [created, setCreated] = useState<string | null>(null);

  if (created)
    return (
      <div className="qa-card" role="status">
        <p>{t.ask.sent}</p>
        <p>
          <Link className="zq-btn zq-btn-secondary" href={`/community/questions/${created}`}>
            {t.ask.view}
          </Link>
        </p>
      </div>
    );

  return (
    <form
      className="qa-card qa-sec"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const topicType = String(f.get("topicType") ?? "");
        const topicRef = String(f.get("topicRef") ?? "").trim();
        setBusy(true);
        setMsg(null);
        try {
          const d = await apiCall<{ id: string }>("/api/mufti/questions", "POST", {
            title: String(f.get("title") ?? ""),
            body: String(f.get("body") ?? ""),
            visibility: String(f.get("visibility") ?? "public"),
            ...(topicType ? { topicType } : {}),
            ...(topicRef ? { topicRef } : {}),
          });
          setCreated(d.id);
        } catch (err) {
          setMsg({ tone: "err", text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="zq-field">
        <label htmlFor="ask-title">{t.ask.titleLabel}</label>
        <input id="ask-title" name="title" className="zq-input" required minLength={8} maxLength={200} aria-describedby="ask-title-d" />
        <span className="zq-help" id="ask-title-d">
          {t.ask.titleHelp}
        </span>
      </div>
      <div className="zq-field">
        <label htmlFor="ask-body">{t.ask.bodyLabel}</label>
        <textarea id="ask-body" name="body" className="zq-textarea" required minLength={20} maxLength={5000} aria-describedby="ask-body-d" />
        <span className="zq-help" id="ask-body-d">
          {t.ask.bodyHelp}
        </span>
      </div>
      <fieldset className="qa-choices">
        <legend>{t.ask.visibilityLabel}</legend>
        <label className="qa-choice">
          <input type="radio" name="visibility" value="public" defaultChecked />
          <span>{t.ask.public}</span>
        </label>
        <label className="qa-choice">
          <input type="radio" name="visibility" value="private" />
          <span>{t.ask.private}</span>
        </label>
      </fieldset>
      <div className="zq-field">
        <label htmlFor="ask-topic">{t.ask.topicLabel}</label>
        <select id="ask-topic" name="topicType" className="zq-input" defaultValue="">
          <option value="">—</option>
          {QUESTION_TOPICS.map((k) => (
            <option key={k} value={k}>
              {t.ask.topics[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="zq-field">
        <label htmlFor="ask-ref">{t.ask.topicRefLabel}</label>
        <input id="ask-ref" name="topicRef" className="zq-input" dir="ltr" maxLength={80} aria-describedby="ask-ref-d" />
        <span className="zq-help" id="ask-ref-d">
          {t.ask.topicRefHelp}
        </span>
      </div>
      <p className="zq-meta">{t.ask.disclaimer}</p>
      <Feedback msg={msg} />
      <div className="qa-actions">
        <button type="submit" className="zq-btn zq-btn-primary" disabled={busy}>
          {busy ? t.ask.sending : t.ask.submit}
        </button>
      </div>
    </form>
  );
}
