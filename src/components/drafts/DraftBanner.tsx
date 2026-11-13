import "@/styles/draft-preview.css";
import { EditorialStatus } from "@/components/ui/evidence";
import Link from "next/link";
import { draftPreviewStrings } from "@/lib/i18n/modules/draftPreview";
import { verificationStrings } from "@/lib/i18n/modules/verification";

/**
 * The notice every draft page carries, on top and always visible: it cannot be closed or hidden. Status badge (word +
 * dot + dashed border + coloured edge, never colour alone) and the plain sentence the owner decided on (2026-11-01).
 */
export function DraftBanner({ locale, preReviewLink = false }: { locale: string; preReviewLink?: boolean }) {
  const t = draftPreviewStrings(locale);
  return (
    <div className="dp-banner-wrap">
      <section className="dp-banner" role="note" aria-label={t.bannerLabel} data-testid="draft-banner">
        <p className="dp-banner-badges">
          <EditorialStatus status="draft">{t.badge}</EditorialStatus>
          <span className="dp-pending" data-testid="review-pending">
            {t.reviewPending}
          </span>
        </p>
        <p className="dp-banner-lead">
          <strong>{t.bannerLead}</strong> {t.bannerBody}
        </p>
        <p className="zq-meta">{t.bannerApart}</p>
        <p className="zq-meta">
          <Link href="/verification">{verificationStrings(locale).howTo}</Link>
        </p>
        {preReviewLink ? <a href="#pre-review">{t.toPreReview}</a> : null}
      </section>
    </div>
  );
}
