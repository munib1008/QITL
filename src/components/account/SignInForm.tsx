"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { decodeIntent, encodeIntent, safeReturnTo } from "@/lib/validation";
import { EmptyState, TextField } from "@/components/ui/misc";

/**
 * Passwordless sign-in by email link (and Google when enabled in Supabase). The return path and any pending
 * action travel through the callback, so the reader lands back where they were and confirms the action there.
 */
export function SignInForm() {
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
      <EmptyState tone="soon" label={<span className="zq-soon">Coming soon</span>} title="Accounts are not open on this site yet.">
        <p>
          Everything is readable without an account. <Link href={returnTo}>Go back to what you were reading</Link>.
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
          After you sign in you will return to the page and be asked to confirm saving the bookmark.
        </p>
      ) : null}
      {err ? (
        <p className="zq-error" role="alert">
          {err === "expired" ? "That sign-in link has expired or was already used. Request a new one." : "Sign-in did not complete. Try again."}
        </p>
      ) : null}
      {state === "sent" ? (
        <div className="pp-card" role="status">
          <h3>Check your email</h3>
          <p style={{ margin: 0 }}>
            We sent a sign-in link to <b>{email}</b>. It works once and expires soon. You can close this tab.
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
              setMessage(error.status === 429 ? "Too many requests. Wait a minute and try again." : "We could not send the link. Check the address and try again.");
            } else setState("sent");
          }}
        >
          <TextField label="Email" id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} help="We email you a one-time sign-in link. No password." error={message ?? undefined} />
          <div>
            <button type="submit" className="zq-btn zq-btn-primary" disabled={state === "sending"} aria-busy={state === "sending" || undefined}>
              {state === "sending" ? "Sending" : "Email me a sign-in link"}
            </button>
          </div>
        </form>
      )}
      {process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1" ? (
        <button type="button" className="zq-btn zq-btn-secondary" onClick={() => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } })}>
          Continue with Google
        </button>
      ) : null}
      <p className="zq-meta">
        By signing in you agree to the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy notice</Link>. Notes are private by default. You can export or
        delete your account at any time.
      </p>
    </div>
  );
}
