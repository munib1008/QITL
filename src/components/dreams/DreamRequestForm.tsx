"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dreamsT } from "@/lib/i18n/modules/dreams";
import { DREAM_LANGUAGES } from "@/lib/dreams";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";

/**
 * The private submission form. It asks only for the dream, an optional question and the answer language: no age,
 * gender, marital status, health or other profile fields, by design (the API schema refuses extra fields too).
 */
export function DreamRequestForm({ locale }: { locale: string }) {
  const t = dreamsT(locale);
  const [days, setDays] = useState(90);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [created, setCreated] = useState<string | null>(null);
  useEffect(() => {
    apiCall<{ retentionDays: number }>("/api/dreams/preferences", "GET")
      .then((d) => setDays(d.retentionDays))
      .catch(() => undefined);
  }, []);

  if (created)
    return (
      <div className="qa-card" role="status">
        <p>{t.form.sent}</p>
        <p>
          <Link className="zq-btn zq-btn-secondary" href={`/dreams/my/${created}`}>
            {t.form.view}
          </Link>
        </p>
      </div>
    );

  return (
    <form
      className="qa-card qa-sec"
      data-testid="dream-form"
      autoComplete="off"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (f.get("consent") !== "yes") return setMsg({ tone: "err", text: t.form.needConsent });
        const question = String(f.get("question") ?? "").trim();
        setBusy(true);
        setMsg(null);
        try {
          const d = await apiCall<{ id: string }>("/api/dreams", "POST", {
            dream: String(f.get("dream") ?? ""),
            ...(question ? { question } : {}),
            language: String(f.get("language") ?? "en"),
            consent: true,
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
        <label htmlFor="dr-dream">{t.form.dreamLabel}</label>
        <textarea id="dr-dream" name="dream" className="zq-textarea" style={{ minHeight: 200 }} required minLength={20} maxLength={6000} aria-describedby="dr-dream-d" />
        <span className="zq-help" id="dr-dream-d">
          {t.form.dreamHelp}
        </span>
      </div>
      <div className="zq-field">
        <label htmlFor="dr-q">{t.form.questionLabel}</label>
        <textarea id="dr-q" name="question" className="zq-textarea" maxLength={1000} aria-describedby="dr-q-d" />
        <span className="zq-help" id="dr-q-d">
          {t.form.questionHelp}
        </span>
      </div>
      <div className="zq-field">
        <label htmlFor="dr-lang">{t.form.languageLabel}</label>
        <select id="dr-lang" name="language" className="zq-input" defaultValue={locale === "ar" ? "ar" : "en"}>
          {DREAM_LANGUAGES.map((l) => (
            <option key={l} value={l} lang={l} dir={l === "en" ? "ltr" : "rtl"}>
              {t.form.languages[l]}
            </option>
          ))}
        </select>
      </div>
      <label className="qa-choice">
        <input type="checkbox" name="consent" value="yes" required />
        <span>{t.form.consent}</span>
      </label>
      <p className="zq-meta">{t.form.retention(days)}</p>
      <Feedback msg={msg} />
      <div className="qa-actions">
        <button type="submit" className="zq-btn zq-btn-primary" disabled={busy}>
          {busy ? t.form.sending : t.form.submit}
        </button>
      </div>
    </form>
  );
}
