"use client";

import { useState } from "react";
import { partnersT } from "@/lib/i18n/modules/partners";
import { REPORT_REASONS } from "@/lib/partners/constants";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";

/** Report a provider to QITL staff. Collapsed by default; the provider is never told who reported. */
export function ReportForm({ locale, partnerId }: { locale: string; partnerId: string }) {
  const t = partnersT(locale).report;
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  return (
    <details className="pt-card">
      <summary style={{ minHeight: "var(--tap)", display: "flex", alignItems: "center", cursor: "pointer", font: "600 15px/22px var(--font-sans)" }}>{t.title}</summary>
      <form
        className="pt-sec"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setMsg(null);
          setBusy(true);
          try {
            await apiCall("/api/partners/reports", "POST", { partner_id: partnerId, reason: String(f.get("reason") ?? ""), details: String(f.get("details") ?? "").trim() || null });
            setMsg({ tone: "ok", text: t.sent });
          } catch (err) {
            setMsg({ tone: "err", text: (err as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="zq-meta">{t.lead}</p>
        <div className="zq-field">
          <label htmlFor="pr-reason">{t.reason}</label>
          <select id="pr-reason" name="reason" className="zq-input" required defaultValue="">
            <option value="" disabled>
              —
            </option>
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {t.reasons[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="pr-details">{t.details}</label>
          <textarea id="pr-details" name="details" className="zq-textarea" maxLength={2000} rows={4} />
        </div>
        <Feedback msg={msg} />
        <div className="pt-actions">
          <button type="submit" className="zq-btn" disabled={busy}>
            {t.send}
          </button>
        </div>
      </form>
    </details>
  );
}
