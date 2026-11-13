import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { VerificationBadge } from "@/components/verification/VerificationBadge";
import { englishContent } from "@/lib/i18n/locales";
import type { LifestyleStrings } from "@/lib/i18n/modules/lifestyle";
import { FIELD_KEYS } from "@/lib/lifestyle/model";
import type { LifestyleDraft } from "@/lib/lifestyle/draft";
import { ayahHash } from "@/lib/refs";

/**
 * The 20-field "How They Lived" profile as an AI draft: each field is either a statement with the Quran verses that support
 * it, or "not established" with the reason. Shown only while no reviewed record exists, under the AI-Assisted Draft badge.
 */
export function DraftFields({ draft, t, locale }: { draft: LifestyleDraft; t: LifestyleStrings; locale: string }) {
  const en = englishContent(locale);
  return (
    <div data-testid="lifestyle-draft">
      <VerificationBadge state="ai_assisted_draft" locale={locale} />
      <ul className="lta-fields">
        {FIELD_KEYS.map((k) => {
          const f = draft.fields[k];
          return (
            <li key={k} className="lta-field" data-field={k} data-known={f.status === "stated" ? "true" : "false"} data-draft="true">
              <h3>{t.fields[k]}</h3>
              {f.status === "stated" ? (
                <>
                  <p style={{ margin: 0 }} {...en}>
                    {f.text_en}
                  </p>
                  <p className="row" style={{ margin: "6px 0 0" }}>
                    <EvidenceLabel kind="quran" />
                    {f.refs.map((r) => (
                      <CitationChip key={`${r.surah}:${r.from}-${r.to}`} href={`/quran/${r.surah}${ayahHash(r.from, r.to)}`}>{`Q ${r.surah}:${r.from}${r.to > r.from ? `–${r.to}` : ""}`}</CitationChip>
                    ))}
                  </p>
                </>
              ) : (
                <p className="zq-meta" style={{ margin: 0 }} {...en}>
                  {f.note_en}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
