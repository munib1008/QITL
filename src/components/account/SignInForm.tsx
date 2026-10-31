"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { decodeIntent, encodeIntent, safeReturnTo } from "@/lib/validation";
import { EmptyState, TextField } from "@/components/ui/misc";
import { accountStrings } from "@/lib/i18n/modules/account";
import { useLocale } from "@/lib/i18n/useLocale";

/**
 * Passwordless sign-in by email link (and Google when enabled in Supabase). The return path and any pending
 * action travel through the callback, so the reader lands back where they were and confirms the action there.
 */
export function SignInForm() {
  const t = accountStrings(useLocale());
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const intent = decodeIntent(params.get("intent"));
  const err = params.get("error");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const sb = getBrowserSupabase();

  if (!sb)
    return (
      <EmptyState tone="soon" label={<span className="zq-soon">{t.soon}</span>} title={t.notOpen}>
        <p>
          {t.readable} <Link href={returnTo}>{t.goBack}</Link>.
        </p>
      </EmptyState>
    );

  const callback = () => {
    const u = new URL("/auth/callback", window.location.origin);
    u.searchParams.set("returnTo", returnTo);
    if (intent) u.searchParams.set("intent", encodeIntent(intent));
    return u.toString();
  };

  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 480 }}>
      {intent ? (
        <p className="zq-banner" role="status">
          {t.intent}
        </p>
      ) : null}
      {err ? (
        <p className="zq-error" role="alert">
          {err === "expired" ? t.expired : t.incomplete}
        </p>
      ) : null}
      {state === "sent" ? (
        <div className="pp-card" role="status">
          <h3>{t.checkEmail}</h3>
          <p style={{ margin: 0 }}>
            {t.sentTo} <b dir="ltr">{email}</b>
            {t.sentAfter}
          </p>
        </div>
      ) : (
        <form
          className="zq-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setState("sending");
            setMessage(null);
            const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: callback(), shouldCreateUser: true } });
            if (error) {
              setState("error");
              setMessage(error.status === 429 ? t.tooMany : t.couldNotSend);
            } else setState("sent");
          }}
        >
          <TextField label={t.email} id="email" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} help={t.emailHelp} error={message ?? undefined} />
          <div>
            <button type="submit" className="zq-btn zq-btn-primary" disabled={state === "sending"} aria-busy={state === "sending" || undefined}>
              {state === "sending" ? t.sending : t.sendLink}
            </button>
          </div>
        </form>
      )}
      {process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1" ? (
        <button type="button" className="zq-btn zq-btn-secondary" onClick={() => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } })}>
          {t.google}
        </button>
      ) : null}
      <p className="zq-meta">
        {t.agree} <Link href="/terms">{t.terms}</Link> {t.and} <Link href="/privacy">{t.privacy}</Link>
        {t.agreeAfter}
      </p>
    </div>
  );
}
