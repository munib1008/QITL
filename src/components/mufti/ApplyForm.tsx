"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { muftiApplyT } from "@/lib/i18n/modules/muftiApply";
import { MADHHABS } from "@/lib/mufti";
import { apiCall, Feedback, type Msg } from "./api";

/**
 * The scholar application form. It sends a request to administrators and nothing more: no role, no profile, no
 * verification. The consent text is shown in full and must be ticked; the API stores the consent version with it.
 */
export function ApplyForm({ locale }: { locale: string }) {
  const t = muftiApplyT(locale);
  const m = muftiT(locale);
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="qa-card qa-sec"
      noValidate={false}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setMsg(null);
        if (f.get("consent") !== "on") {
          setMsg({ tone: "err", text: t.form.consentRequired });
          return;
        }
        const links = String(f.get("links") ?? "")
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        setBusy(true);
        try {
          await apiCall("/api/mufti/applications", "POST", {
            name: String(f.get("name") ?? ""),
            credentials: String(f.get("credentials") ?? ""),
            madhhab: String(f.get("madhhab") ?? "") || null,
            field: String(f.get("field") ?? "").trim() || null,
            links,
            consent: true,
          });
          setMsg({ tone: "ok", text: t.form.sent });
          router.refresh();
        } catch (err) {
          setMsg({ tone: "err", text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="zq-field">
        <label htmlFor="ap-name">{t.form.name}</label>
        <input id="ap-name" name="name" className="zq-input" required minLength={2} maxLength={120} autoComplete="name" aria-describedby="ap-name-d" />
        <span className="zq-help" id="ap-name-d">
          {t.form.nameHelp}
        </span>
      </div>
      <div className="zq-field">
        <label htmlFor="ap-cred">{t.form.credentials}</label>
        <textarea id="ap-cred" name="credentials" className="zq-textarea" required minLength={20} maxLength={5000} rows={6} aria-describedby="ap-cred-d" />
        <span className="zq-help" id="ap-cred-d">
          {t.form.credentialsHelp}
        </span>
      </div>
      <div className="zq-field">
        <label htmlFor="ap-madhhab">{t.form.madhhab}</label>
        <select id="ap-madhhab" name="madhhab" className="zq-input" defaultValue="">
          {["", ...MADHHABS].map((x) => (
            <option key={x} value={x}>
              {m.workspace.madhhabs[x]}
            </option>
          ))}
        </select>
      </div>
      <div className="zq-field">
        <label htmlFor="ap-field">{t.form.field}</label>
        <input id="ap-field" name="field" className="zq-input" minLength={2} maxLength={120} aria-describedby="ap-field-d" />
        <span className="zq-help" id="ap-field-d">
          {t.form.fieldHelp}
        </span>
      </div>
      <div className="zq-field">
        <label htmlFor="ap-links">{t.form.links}</label>
        <textarea id="ap-links" name="links" className="zq-textarea" rows={3} dir="ltr" inputMode="url" autoCapitalize="off" spellCheck={false} aria-describedby="ap-links-d" />
        <span className="zq-help" id="ap-links-d">
          {t.form.linksHelp}
        </span>
      </div>
      <label className="qa-choice" htmlFor="ap-consent">
        <input id="ap-consent" name="consent" type="checkbox" required />
        <span>{t.form.consent}</span>
      </label>
      <Feedback msg={msg} />
      <div className="qa-actions">
        <button type="submit" className="zq-btn zq-btn-primary" disabled={busy}>
          {busy ? t.form.sending : t.form.submit}
        </button>
      </div>
    </form>
  );
}
