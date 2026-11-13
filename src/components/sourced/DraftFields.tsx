import "@/styles/sourced.css";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { VerificationBadge } from "@/components/verification/VerificationBadge";
import { englishContent } from "@/lib/i18n/locales";
import type { SourcedField } from "@/lib/sourced/draft";
import { ayahHash } from "@/lib/refs";

/**
 * The fields of a Quran-only AI draft: each is a statement with the verses that support it, or "not established" with the
 * reason. Always under the AI-Assisted Draft badge; the English text is marked as English content in the Arabic and Urdu pages.
 */
export function DraftFields({ fields, order, labels, locale, testId }: { fields: Record<string, SourcedField>; order: readonly string[]; labels: Record<string, string>; locale: string; testId: string }) {
  const en = englishContent(locale);
  return (
    <div data-testid={testId}>
      <VerificationBadge state="ai_assisted_draft" locale={locale} />
      <ul className="sd-fields">
        {order.map((k) => {
          const f = fields[k];
          if (!f) return null;
          return (
            <li key={k} className="sd-field" data-field={k} data-known={f.status === "stated" ? "true" : "false"}>
              <h3>{labels[k] ?? k}</h3>
              {f.status === "stated" ? (
                <>
                  <p {...en}>{f.text_en}</p>
                  <p className="sd-refs">
                    <EvidenceLabel kind="quran" />
                    {f.refs.map((r) => (
                      <CitationChip key={`${r.surah}:${r.from}-${r.to}`} href={`/quran/${r.surah}${ayahHash(r.from, r.to)}`}>{`Q ${r.surah}:${r.from}${r.to > r.from ? `–${r.to}` : ""}`}</CitationChip>
                    ))}
                  </p>
                </>
              ) : (
                <p {...en}>{f.note_en}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
