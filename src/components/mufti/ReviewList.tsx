"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { citationDisplay, type CitationRow } from "@/lib/mufti";
import { apiCall, Feedback, type Msg } from "./api";
import { Pill } from "./ui";

export interface ReviewItem {
  id: string;
  version: number;
  body_md: string;
  question_title: string;
  question_id: string;
  citations: CitationRow[];
}

/** Reviewer queue: approve or request changes on another mufti's submitted answer (never one's own). */
export function ReviewList({ items, locale }: { items: ReviewItem[]; locale: string }) {
  const t = muftiT(locale);
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  if (!items.length) return <p className="zq-meta">{t.workspace.noReview}</p>;
  const review = async (it: ReviewItem, decision: "approved" | "changes_requested" | "rejected", note: string) => {
    setMsg(null);
    try {
      await apiCall("/api/mufti/reviews", "POST", { answerId: it.id, version: it.version, decision, ...(note ? { note } : {}) });
      setMsg({ tone: "ok", text: t.reviewer.done });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    }
  };
  return (
    <div className="qa-sec">
      <Feedback msg={msg} />
      <ul className="qa-list">
        {items.map((it) => (
          <li key={it.id} className="qa-card">
            <b>{it.question_title}</b>
            <div className="qa-meta">
              <span>v{it.version}</span>
              {it.citations.map((c, i) => (
                <Pill key={i}>
                  {t.cite[c.kind]}: <span dir="ltr">{citationDisplay(c).label}</span>
                </Pill>
              ))}
            </div>
            <div className="qa-quote">{it.body_md}</div>
            <form
              className="qa-sec"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const decision = ((e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "approved") as "approved" | "changes_requested" | "rejected";
                void review(it, decision, String(f.get("note") ?? "").trim());
              }}
            >
              <div className="zq-field">
                <label htmlFor={`rv-note-${it.id}`}>{t.reviewer.note}</label>
                <textarea id={`rv-note-${it.id}`} name="note" className="zq-textarea" maxLength={2000} />
              </div>
              <div className="qa-actions">
                <button type="submit" name="decision" value="approved" className="zq-btn zq-btn-primary">
                  {t.reviewer.approve}
                </button>
                <button type="submit" name="decision" value="changes_requested" className="zq-btn zq-btn-secondary">
                  {t.reviewer.requestChanges}
                </button>
                <button type="submit" name="decision" value="rejected" className="zq-btn zq-btn-quiet">
                  {t.reviewer.reject}
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
