import "@/styles/verification.css";
import Link from "next/link";
import { STATE_TONE, type ReviewKind, type VerificationState } from "@/lib/verification/model";
import { verificationStrings } from "@/lib/i18n/modules/verification";

export interface VerificationDetail {
  /** What the reviewer or the automated checks verified, when anything was. */
  checked?: string;
  /** What remains unverified. */
  unchecked?: string;
  sources?: Array<{ label: string; href?: string }>;
  reviewerRole?: string;
  reviewedOn?: string;
  limits?: string;
  reportHref?: string;
  historyHref?: string;
}

/**
 * The one badge every module uses for a content item's verification state, with a visible (not tooltip-only) disclosure
 * that says what has and has not been checked. The label is always text, never colour alone. A "verified" badge here
 * only ever comes from a state computed by src/lib/verification/model.ts, which needs a recorded human review.
 */
export function VerificationBadge({ state, locale, detail, kind = "scholarly", notice = true }: { state: VerificationState; locale: string; detail?: VerificationDetail; kind?: ReviewKind; notice?: boolean }) {
  const t = verificationStrings(locale);
  const s = t.states[state];
  const draftNotice = state === "ai_assisted_draft" ? t.draftNotice.ai : state === "pending_verification" ? t.draftNotice[kind === "scientific" ? "scientific" : kind === "language" ? "language" : "scholarly"] : null;
  return (
    <div className="vf" data-state={state} data-tone={STATE_TONE[state]} data-testid="verification-badge">
      <p className="vf-head">
        <span className="vf-badge" role="status" aria-label={`${t.statesLabel}: ${s.label}`}>
          <span className="vf-dot" aria-hidden="true" />
          {s.label}
        </span>
        <Link className="vf-link" href="/verification">
          {t.howTo}
        </Link>
      </p>
      {notice && draftNotice ? (
        <p className="vf-notice" data-testid="verification-notice">
          {draftNotice}
        </p>
      ) : null}
      {notice && (state === "ai_assisted_draft" || state === "pending_verification") ? (
        <p className="vf-verify" data-testid="verification-verify-yourself">
          {t.verifyYourself}
        </p>
      ) : null}
      <details className="vf-more">
        <summary>{s.label}</summary>
        <p>{s.what}</p>
        <dl>
          <dt>{t.verifiedWhat}</dt>
          <dd>{detail?.checked ?? t.noReviewer}</dd>
          <dt>{t.unverifiedWhat}</dt>
          <dd>{detail?.unchecked ?? s.what}</dd>
          {detail?.reviewerRole ? (
            <>
              <dt>{t.reviewer}</dt>
              <dd>{detail.reviewerRole}</dd>
            </>
          ) : null}
          {detail?.reviewedOn ? (
            <>
              <dt>{t.reviewedOn}</dt>
              <dd>{detail.reviewedOn}</dd>
            </>
          ) : null}
          {detail?.limits ? (
            <>
              <dt>{t.limits}</dt>
              <dd>{detail.limits}</dd>
            </>
          ) : null}
        </dl>
        {detail?.sources?.length ? (
          <>
            <h4>{t.sources}</h4>
            <ul>
              {detail.sources.map((x) => (
                <li key={x.label}>{x.href ? <Link href={x.href}>{x.label}</Link> : x.label}</li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="vf-actions">
          {detail?.reportHref ? <Link href={detail.reportHref}>{t.report}</Link> : null}
          {detail?.historyHref ? <Link href={detail.historyHref}>{t.history}</Link> : null}
        </p>
      </details>
    </div>
  );
}
