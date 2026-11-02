"use client";

import { useState } from "react";
import { partnersT } from "@/lib/i18n/modules/partners";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";

/**
 * Ask a provider a question. The learner must tick the consent text; the message goes to the provider's team and QITL
 * staff only. The learner's alias is optional and the form asks for no surname, address or phone number.
 */
export function InquiryForm({ locale, partnerId, services }: { locale: string; partnerId: string; services: Array<{ id: string; title: string }> }) {
  const t = partnersT(locale).inquiry;
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <p role="status" className="zq-help">{t.sent}</p>;
  return (
    <form
      className="pt-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setMsg(null);
        if (f.get("consent") !== "on") {
          setMsg({ tone: "err", text: t.consentRequired });
          return;
        }
        setBusy(true);
        try {
          await apiCall("/api/partners/inquiries", "POST", {
            partner_id: partnerId,
            service_id: String(f.get("service") ?? "") || null,
            learner_alias: String(f.get("alias") ?? "").trim() || null,
            for_child: f.get("child") === "on",
            subject: String(f.get("subject") ?? ""),
            message: String(f.get("message") ?? ""),
            consent: true,
          });
          setDone(true);
        } catch (err) {
          setMsg({ tone: "err", text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 id="pt-inquiry-h">{t.title}</h2>
      <p className="zq-meta">{t.intro}</p>
      {services.length ? (
        <div className="zq-field">
          <label htmlFor="pi-service">{t.service}</label>
          <select id="pi-service" name="service" className="zq-input" defaultValue="">
            <option value="">{t.anyService}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="zq-field">
        <label htmlFor="pi-alias">{t.alias}</label>
        <input id="pi-alias" name="alias" className="zq-input" maxLength={40} autoComplete="off" aria-describedby="pi-alias-d" />
        <span className="zq-help" id="pi-alias-d">
          {t.aliasHelp}
        </span>
      </div>
      <label className="pt-choice" htmlFor="pi-child">
        <input id="pi-child" name="child" type="checkbox" />
        <span>{t.forChild}</span>
      </label>
      <div className="zq-field">
        <label htmlFor="pi-subject">{t.subject}</label>
        <input id="pi-subject" name="subject" className="zq-input" required minLength={3} maxLength={140} />
      </div>
      <div className="zq-field">
        <label htmlFor="pi-message">{t.message}</label>
        <textarea id="pi-message" name="message" className="zq-textarea" required minLength={10} maxLength={2000} rows={6} aria-describedby="pi-message-d" />
        <span className="zq-help" id="pi-message-d">
          {t.messageHelp}
        </span>
      </div>
      <label className="pt-choice" htmlFor="pi-consent">
        <input id="pi-consent" name="consent" type="checkbox" required />
        <span>{t.consent}</span>
      </label>
      <Feedback msg={msg} />
      <div className="pt-actions">
        <button type="submit" className="zq-btn zq-btn-primary" disabled={busy}>
          {busy ? t.sending : t.send}
        </button>
      </div>
    </form>
  );
}
