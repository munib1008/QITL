import type { ReactNode } from "react";
import "@/styles/partners.css";
import { partnersT } from "@/lib/i18n/modules/partners";

type T = ReturnType<typeof partnersT>;

export function Notice({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <aside className="pt-notice" data-testid={testId} aria-label={title}>
      <b>{title}</b>
      <p>{children}</p>
    </aside>
  );
}

/** The sentence every Learning Partners page must show: QITL is not a payment platform. */
export function PaymentsNotice({ t }: { t: T }) {
  return (
    <Notice title={t.notices.paymentsTitle} testId="payments-notice">
      {t.notices.payments}
    </Notice>
  );
}

/** What verification does and does not guarantee (separate from the payments sentence on purpose). */
export function VerificationNotice({ t }: { t: T }) {
  return (
    <Notice title={t.notices.verificationTitle} testId="verification-notice">
      {t.notices.verification}
    </Notice>
  );
}

/** Religious instruction is not a fatwa; provider claims are the provider's; learners under 18. */
export function ScopeNotices({ t, safeguarding = false }: { t: T; safeguarding?: boolean }) {
  return (
    <div className="pt-notices">
      <Notice title={t.notices.instructionTitle} testId="instruction-notice">
        {t.notices.instruction}
      </Notice>
      <Notice title={t.notices.claimsTitle} testId="claims-notice">
        {t.notices.claims}
      </Notice>
      {safeguarding ? (
        <Notice title={t.notices.safeguardingTitle} testId="safeguarding-notice">
          {t.notices.safeguarding}
        </Notice>
      ) : null}
    </div>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: "ok" | "warn" }) {
  return (
    <span className="pt-pill" data-tone={tone}>
      {children}
    </span>
  );
}

/** Country or language names in the reader's language, without a hand-kept list. */
export function regionName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
export function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
