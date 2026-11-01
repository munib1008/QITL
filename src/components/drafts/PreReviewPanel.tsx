import "@/styles/draft-preview.css";
import { Markdown } from "@/components/ui/Markdown";
import { englishContent } from "@/lib/i18n/locales";
import { draftPreviewStrings } from "@/lib/i18n/modules/draftPreview";
import type { PreReview } from "@/lib/stories/draft-preview";

/**
 * "AI pre-review": the counts the automated validator produced when the preview index was built, and the scholars'
 * checklist, unchecked. It is not a scholarly review and never shows an approval, a reviewer or a date.
 */
export function PreReviewPanel({ locale, pre, checklist }: { locale: string; pre: PreReview; checklist: string[] }) {
  const t = draftPreviewStrings(locale);
  const en = englishContent(locale);
  const stats: Array<[string, number]> = [
    [t.preErrors, pre.errors],
    [t.preWarnings, pre.warnings],
    [t.preInfo, pre.info],
    [t.preClaims, pre.claims],
    [t.preRanges, pre.verseRanges],
    [t.preAyat, pre.ayat],
  ];
  return (
    <section id="pre-review" className="dp-pre" aria-labelledby="pre-h" data-testid="pre-review">
      <h2 id="pre-h">{t.preTitle}</h2>
      <p>{t.preIntro}</p>
      <p className="dp-pre-status" data-testid="review-status">
        {t.preStatus}: <span>{t.preStatusValue}</span>
      </p>
      <p className="zq-meta">{t.preNoApproval}</p>
      <dl className="dp-stats">
        {stats.map(([label, n]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
      <p>{t.preRulesPassed(pre.rulesPassed.length, pre.rulesChecked.length)}</p>
      <details className="sc-sources">
        <summary>{t.preRulesList}</summary>
        <ul className="dp-rules" dir="ltr">
          {pre.rulesPassed.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
      <p>
        {t.preRulesFound}:{" "}
        {pre.rulesWithFindings.length ? (
          <span className="dp-rules" dir="ltr" style={{ display: "inline-flex" }}>
            {pre.rulesWithFindings.join(", ")}
          </span>
        ) : (
          t.preRulesNone
        )}
      </p>
      <h3>{t.checklistTitle}</h3>
      <p className="zq-meta">{t.checklistIntro}</p>
      <ol className="dp-checklist" data-testid="scholar-checklist">
        {checklist.map((item, i) => (
          <li key={i}>
            <div {...en}>
              <Markdown source={item} />
            </div>
            <span className="dp-todo">
              <span className="dp-box" aria-hidden="true" /> {t.checklistBox}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
