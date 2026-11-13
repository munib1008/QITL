import type { ReactNode } from "react";
import Link from "next/link";
import { DraftBanner } from "@/components/drafts/DraftBanner";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { englishContent } from "@/lib/i18n/locales";
import { publicAiDraftGate } from "@/lib/stories/ai-draft-gate";
import { draftOutline, draftSlugFor } from "@/lib/stories/draft-outline";
import { draftPreviewStrings } from "@/lib/i18n/modules/draftPreview";
import { ayahHash } from "@/lib/refs";

/**
 * The outline of a prophet's story, built from the chapters of the public AI draft (title, summary, the verses cited), under
 * the draft banner. Shown only when the database released the draft; otherwise the fallback. Never presented as reviewed.
 */
export async function AiDraftOutline({ slug, locale, fallback }: { slug: string; locale: string; fallback: ReactNode }) {
  const gate = await publicAiDraftGate();
  const ds = draftSlugFor(slug);
  const steps = gate?.has(ds) ? draftOutline(slug) : null;
  if (!steps) return <>{fallback}</>;
  const en = englishContent(locale);
  return (
    <div data-testid="ai-draft-outline">
      <DraftBanner locale={locale} />
      <ol className="pp-steps" data-testid="story-steps">
        {steps.map((s) => (
          <li key={s.title} className="pp-step">
            <h3 {...en}>{s.title}</h3>
            {s.summary ? <p {...en}>{s.summary}</p> : null}
            <div className="row">
              <EvidenceLabel kind="quran" />
              {s.refs.map((r) => (
                <CitationChip key={`${r.surah}:${r.from}-${r.to}`} href={`/quran/${r.surah}${ayahHash(r.from, r.to)}`}>{`Q ${r.surah}:${r.from}${r.to > r.from ? `–${r.to}` : ""}`}</CitationChip>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <p className="zq-meta">
        <Link href={`/drafts/${ds}`}>{draftPreviewStrings(locale).draftWord}</Link>
      </p>
    </div>
  );
}
