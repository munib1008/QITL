"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dreamsT } from "@/lib/i18n/modules/dreams";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";

/** The submitter's controls on one request: consent, second opinion, withdraw / close, retention and deletion. */
export function DreamRequestActions({
  requestId,
  status,
  retainUntil,
  scholarAccess,
  releasedResponseId,
  secondOpinionOpen,
  locale,
}: {
  requestId: string;
  status: string;
  retainUntil: string;
  scholarAccess: boolean;
  releasedResponseId: string | null;
  secondOpinionOpen: boolean;
  locale: string;
}) {
  const t = dreamsT(locale);
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [confirm, setConfirm] = useState("");
  const url = `/api/dreams/${requestId}`;
  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "ok", text: t.detail.done });
      if (after) after();
      else router.refresh();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    }
  };
  const maxDate = retainUntil.slice(0, 10);
  const minDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="qa-sec">
      <Feedback msg={msg} />

      <section className="qa-card qa-sec" aria-labelledby="dr-consent-h">
        <h2 id="dr-consent-h">{t.detail.consent}</h2>
        <p>{scholarAccess ? t.detail.consentOn : t.detail.consentOff}</p>
        <div className="qa-actions">
          <button type="button" className="zq-btn zq-btn-secondary" onClick={() => run(() => apiCall(url, "PATCH", { scholarAccess: !scholarAccess }))}>
            {scholarAccess ? t.detail.withdrawConsent : t.detail.restoreConsent}
          </button>
          {status === "submitted" || status === "assigned" ? (
            <button type="button" className="zq-btn zq-btn-quiet" onClick={() => run(() => apiCall(url, "PATCH", { status: "withdrawn" }))}>
              {t.detail.withdraw}
            </button>
          ) : null}
          {status === "answered" ? (
            <button type="button" className="zq-btn zq-btn-quiet" onClick={() => run(() => apiCall(url, "PATCH", { status: "closed" }))}>
              {t.detail.close}
            </button>
          ) : null}
        </div>
      </section>

      {releasedResponseId && scholarAccess && status !== "withdrawn" ? (
        <section className="qa-card qa-sec" aria-labelledby="dr-second-h">
          <h2 id="dr-second-h">{t.detail.secondTitle}</h2>
          {secondOpinionOpen ? (
            <p>{t.detail.secondOpen}</p>
          ) : (
            <form
              className="qa-sec"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => apiCall(`${url}/second-opinion`, "POST", { firstResponseId: releasedResponseId, consent: true }));
              }}
            >
              <p>{t.detail.secondBody}</p>
              <label className="qa-choice">
                <input type="checkbox" required />
                <span>{t.detail.secondConsent}</span>
              </label>
              <div className="qa-actions">
                <button type="submit" className="zq-btn zq-btn-secondary">
                  {t.detail.secondAsk}
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      <section className="qa-card qa-sec" aria-labelledby="dr-del-h">
        <h2 id="dr-del-h">{t.mine.privacy}</h2>
        <form
          className="qa-actions"
          style={{ alignItems: "flex-end" }}
          onSubmit={(e) => {
            e.preventDefault();
            const v = String(new FormData(e.currentTarget).get("until") ?? "");
            if (v) void run(() => apiCall(url, "PATCH", { retainUntil: new Date(`${v}T00:00:00Z`).toISOString() }));
          }}
        >
          <div className="zq-field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="dr-until">{t.detail.shortenLabel}</label>
            <input id="dr-until" name="until" type="date" className="zq-input" min={minDate} max={maxDate} defaultValue={maxDate} />
          </div>
          <button type="submit" className="zq-btn zq-btn-secondary">
            {t.detail.shortenSave}
          </button>
        </form>
        <form
          className="qa-sec"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () => apiCall(url, "DELETE", { confirm }),
              () => router.push("/dreams/my"),
            );
          }}
        >
          <div className="zq-field">
            <label htmlFor="dr-del">{t.detail.deleteLabel}</label>
            <input id="dr-del" className="zq-input" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-describedby="dr-del-d" autoComplete="off" />
            <span className="zq-help" id="dr-del-d">
              {t.detail.deleteConfirm}
            </span>
          </div>
          <div className="qa-actions">
            <button type="submit" className="zq-btn zq-btn-danger" disabled={confirm !== "DELETE"}>
              {t.detail.delete}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
