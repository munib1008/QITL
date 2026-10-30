import type { ReactNode } from "react";
import { EvidenceLabel } from "@/components/ui/evidence";
import { Markdown } from "@/components/ui/Markdown";
import type { EvidenceKind } from "@/content/labels";
import type { EvidenceBlock, EvidenceCategory } from "@/lib/lifestyle/model";
import type { LifestyleStrings } from "@/lib/i18n/modules/lifestyle";

/** A–D map onto the site's evidence marks (word + mark + border, never colour alone). */
const MARK: Record<EvidenceCategory, EvidenceKind> = { A: "quran", B: "hadith", C: "estimate", D: "disputed" };

export function CategoryBadge({ category, t }: { category: EvidenceCategory | null; t: LifestyleStrings }) {
  if (!category) return <EvidenceLabel kind="unknown">{t.notEstablished}</EvidenceLabel>;
  return (
    <span data-category={category} title={t.categoryHelp[category]}>
      <EvidenceLabel kind={MARK[category]}>{t.categories[category]}</EvidenceLabel>
    </span>
  );
}

/** The evidence block, always visible (never behind hover): citation, publication, dating, geography, confidence. */
export function RecordMeta({ r, t }: { r: EvidenceBlock; t: LifestyleStrings }) {
  const rows: Array<[string, ReactNode]> = [];
  if (r.primary_citation) rows.push([t.meta.citation, <span key="c" data-citation="">{r.primary_citation}</span>]);
  if (r.publication) rows.push([t.meta.publication, r.publication]);
  if (r.dating_method) rows.push([t.meta.dating, r.dating_method]);
  if (r.geographic_relevance) rows.push([t.meta.geography, r.geographic_relevance]);
  if (r.language) rows.push([t.meta.language, r.language]);
  if (r.last_reviewed_at) rows.push([t.meta.reviewed, r.last_reviewed_at]);
  if (r.limitations) rows.push([t.meta.limitations, r.limitations]);
  return (
    <div className="lta-meta">
      <div className="lta-badges">
        <CategoryBadge category={r.evidence_category} t={t} />
        {r.confidence ? <span className="lta-conf">{t.confidence[r.confidence]}</span> : null}
      </div>
      {rows.length ? (
        <dl>
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/**
 * Class D, always in its own visually separate container with the "Reconstruction — not established" heading.
 * Nothing inside it is ever presented as fact.
 */
export function ReconstructionContainer({ t, children, title }: { t: LifestyleStrings; children: ReactNode; title?: string }) {
  return (
    <aside className="lta-recon" data-testid="reconstruction" data-category="D" aria-label={t.reconstruction}>
      <p className="lta-recon-tag">
        <EvidenceLabel kind="disputed">{t.reconstruction}</EvidenceLabel>
      </p>
      {title ? <h3>{title}</h3> : null}
      <p className="lta-recon-help">{t.reconstructionHelp}</p>
      <div className="lta-recon-body">{children}</div>
    </aside>
  );
}

/** One record card: text, then its evidence. A class D record is routed into the reconstruction container. */
export function RecordCard({ r, t, title, body }: { r: EvidenceBlock; t: LifestyleStrings; title: string; body?: string | null }) {
  const inner = (
    <>
      {title ? <h3 className="lta-card-title">{title}</h3> : null}
      {body ? <Markdown source={body} /> : null}
      <RecordMeta r={r} t={t} />
    </>
  );
  if (r.evidence_category === "D") return <ReconstructionContainer t={t}>{inner}</ReconstructionContainer>;
  return <article className="pp-card lta-card">{inner}</article>;
}
