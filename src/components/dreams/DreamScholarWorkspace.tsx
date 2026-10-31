"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dreamsT } from "@/lib/i18n/modules/dreams";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { DREAM_OUTCOMES } from "@/lib/dreams";
import { citationDisplay, type CitationRow } from "@/lib/mufti";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";
import { CitationForm } from "@/components/mufti/CitationForm";
import { Pill } from "@/components/mufti/ui";

export interface ScholarResponse {
  id: string;
  outcome: string;
  body_md: string;
  status: string;
  review_status: string;
  version: number;
  fallibility_acknowledged: boolean;
  references: Array<CitationRow & { id: string }>;
}

/** A qualified scholar's workspace on one assigned request: respond (or review another scholar's response). */
export function DreamScholarWorkspace({
  requestId,
  role,
  mine,
  others,
  secondOpinionId,
  locale,
}: {
  requestId: string;
  role: string;
  mine: ScholarResponse | null;
  others: ScholarResponse[];
  secondOpinionId: string | null;
  locale: string;
}) {
  const t = dreamsT(locale);
  const m = muftiT(locale);
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [ack, setAck] = useState(Boolean(mine?.fallibility_acknowledged));
  const run = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "ok", text: m.composer.saved });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    }
  };
  const canRespond = role === "primary" || (role === "second_opinion" && secondOpinionId);
  const outcomeSelect = (id: string, value?: string) => (
    <div className="zq-field">
      <label htmlFor={id}>{t.scholar.outcomeLabel}</label>
      <select id={id} name="outcome" className="zq-input" defaultValue={value ?? "meaning_unknown"} required>
        {DREAM_OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {t.outcomes[o]}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="qa-sec">
      <p className="qa-notice">{t.scholar.noAi}</p>
      <Feedback msg={msg} />

      {canRespond && !mine ? (
        <form
          className="qa-card qa-sec"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(() =>
              apiCall("/api/dreams/responses", "POST", {
                requestId,
                outcome: String(f.get("outcome")),
                body: String(f.get("body") ?? ""),
                ...(role === "second_opinion" && secondOpinionId ? { secondOpinionId } : {}),
              }),
            );
          }}
        >
          <h2>{t.scholar.yourResponses}</h2>
          {outcomeSelect("ds-outcome")}
          <div className="zq-field">
            <label htmlFor="ds-body">{t.scholar.bodyLabel}</label>
            <textarea id="ds-body" name="body" className="zq-textarea" style={{ minHeight: 200 }} required minLength={20} maxLength={8000} aria-describedby="ds-body-d" />
            <span className="zq-help" id="ds-body-d">
              {t.scholar.bodyHelp}
            </span>
          </div>
          <div className="qa-actions">
            <button type="submit" className="zq-btn zq-btn-secondary">
              {t.scholar.saveDraft}
            </button>
          </div>
        </form>
      ) : null}

      {mine ? (
        <section className="qa-card qa-sec" aria-labelledby="ds-mine-h">
          <h2 id="ds-mine-h">{t.scholar.yourResponses}</h2>
          <div className="qa-meta">
            <Pill>{m.composer.statuses[mine.status === "released" ? "published" : mine.status] ?? mine.status}</Pill>
            <Pill>{m.composer.reviews[mine.review_status] ?? mine.review_status}</Pill>
            <span>v{mine.version}</span>
          </div>
          <form
            className="qa-sec"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() => apiCall(`/api/dreams/responses/${mine.id}`, "PATCH", { outcome: String(f.get("outcome")), body: String(f.get("body") ?? "") }));
            }}
          >
            {outcomeSelect("ds-outcome-edit", mine.outcome)}
            <div className="zq-field">
              <label htmlFor="ds-edit">{t.scholar.bodyLabel}</label>
              <textarea id="ds-edit" name="body" className="zq-textarea" style={{ minHeight: 200 }} defaultValue={mine.body_md} required minLength={20} maxLength={8000} aria-describedby="ds-edit-d" />
              <span className="zq-help" id="ds-edit-d">
                {m.composer.editNote}
              </span>
            </div>
            <div className="qa-actions">
              <button type="submit" className="zq-btn zq-btn-secondary">
                {t.scholar.saveDraft}
              </button>
              {mine.status === "draft" || mine.status === "withdrawn" ? (
                <button type="button" className="zq-btn zq-btn-primary" onClick={() => run(() => apiCall(`/api/dreams/responses/${mine.id}`, "PATCH", { status: "submitted" }))}>
                  {t.scholar.submit}
                </button>
              ) : null}
            </div>
          </form>
          {mine.status === "submitted" ? (
            <div className="qa-sec">
              <label className="qa-choice">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>
                  {t.scholar.acknowledge} <q>{t.fallibility}</q>
                </span>
              </label>
              <div className="qa-actions">
                <button
                  type="button"
                  className="zq-btn zq-btn-primary"
                  disabled={!ack || mine.review_status !== "approved"}
                  onClick={() => run(() => apiCall(`/api/dreams/responses/${mine.id}`, "PATCH", { status: "released", acknowledged: true }))}
                >
                  {t.scholar.release}
                </button>
              </div>
            </div>
          ) : null}
          <h3>{t.detail.references}</h3>
          {mine.references.length ? (
            <ul className="qa-list">
              {mine.references.map((c) => (
                <li key={c.id} className="qa-actions">
                  <Pill>{m.cite[c.kind]}</Pill>
                  <span dir="ltr">{citationDisplay(c).label}</span>
                  {mine.status !== "released" ? (
                    <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => run(() => apiCall(`/api/dreams/responses/${mine.id}/references?referenceId=${c.id}`, "DELETE"))}>
                      {m.composer.remove}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="zq-meta">{m.question.noCitations}</p>
          )}
          {mine.status !== "released" ? <CitationForm endpoint={`/api/dreams/responses/${mine.id}/references`} locale={locale} onAdded={() => router.refresh()} idPrefix="ds-ref" /> : null}
        </section>
      ) : null}

      {others.length ? (
        <section className="qa-sec" aria-labelledby="ds-others-h">
          <h2 id="ds-others-h">{t.scholar.reviewThis}</h2>
          <ul className="qa-list">
            {others.map((o) => (
              <li key={o.id} className="qa-card">
                <div className="qa-meta">
                  <Pill>{t.outcomes[o.outcome] ?? o.outcome}</Pill>
                  <Pill>{m.composer.reviews[o.review_status] ?? o.review_status}</Pill>
                  <span>v{o.version}</span>
                </div>
                <div className="qa-quote">{o.body_md}</div>
                {o.status === "submitted" ? (
                  <form
                    className="qa-sec"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const decision = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "approved";
                      const note = String(new FormData(e.currentTarget).get("note") ?? "").trim();
                      void run(() => apiCall("/api/dreams/reviews", "POST", { responseId: o.id, version: o.version, decision, ...(note ? { note } : {}) }));
                    }}
                  >
                    <div className="zq-field">
                      <label htmlFor={`ds-rv-${o.id}`}>{t.scholar.reviewNote}</label>
                      <textarea id={`ds-rv-${o.id}`} name="note" className="zq-textarea" maxLength={2000} />
                    </div>
                    <div className="qa-actions">
                      <button type="submit" value="approved" className="zq-btn zq-btn-primary">
                        {t.scholar.approve}
                      </button>
                      <button type="submit" value="changes_requested" className="zq-btn zq-btn-secondary">
                        {t.scholar.requestChanges}
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
