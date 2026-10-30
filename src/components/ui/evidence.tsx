import type { ReactNode } from "react";
import Link from "next/link";
import { ERA_TEXT, type EraCertainty, type EvidenceKind } from "@/content/labels";
import { EvidenceMark } from "./icons";

export const EVIDENCE_TEXT: Record<"en" | "ar", Record<EvidenceKind, string>> = {
  en: {
    quran: "Quran",
    hadith: "Authentic Hadith",
    scholar: "Scholarly interpretation",
    estimate: "Historical estimate",
    disputed: "Disputed",
    unknown: "Unknown",
  },
  ar: {
    quran: "القرآن",
    hadith: "حديث صحيح",
    scholar: "تفسير العلماء",
    estimate: "تقدير تاريخي",
    disputed: "مختلف فيه",
    unknown: "غير معلوم",
  },
};

export interface EvidenceLabelProps {
  kind: EvidenceKind;
  lang?: "en" | "ar";
  title?: string;
  children?: ReactNode;
}

/** What kind of knowledge a claim rests on: word + mark + border style, never colour alone. Always visible. */
export function EvidenceLabel({ kind, lang = "en", title, children }: EvidenceLabelProps) {
  return (
    <span className={`zq-ev zq-ev-${kind}`} title={title} data-evidence={kind}>
      <EvidenceMark kind={kind} />
      <span>{children ?? EVIDENCE_TEXT[lang][kind]}</span>
    </span>
  );
}

export interface CitationChipProps {
  kind?: string;
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  children: ReactNode;
}

/** A visible citation anchor. The reference string is always LTR mono. */
export function CitationChip({ kind, href, onClick, ariaLabel, children }: CitationChipProps) {
  const inner = (
    <>
      {kind ? <span className="zq-chip-kind">{kind}</span> : null}
      <span dir="ltr">{children}</span>
    </>
  );
  if (href)
    return (
      <Link className="zq-chip" href={href} aria-label={ariaLabel} data-citation="">
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" className="zq-chip" onClick={onClick} aria-label={ariaLabel} data-citation="">
        {inner}
      </button>
    );
  // Without a target the chip is a plain visible citation, not a dead button.
  return (
    <span className="zq-chip zq-chip-static" aria-label={ariaLabel} data-citation="">
      {inner}
    </span>
  );
}

export interface HadithGradeProps {
  grade?: string;
  grader?: string;
  source?: string;
  authentic?: boolean;
  varies?: boolean;
}

/** One grading of one narration by one named scholar. Never inferred from the collection name. */
export function HadithGrade({ grade, grader, source, authentic, varies }: HadithGradeProps) {
  const kind: EvidenceKind = authentic && grader ? "hadith" : grade ? "scholar" : "unknown";
  return (
    <span className="zq-grade">
      <EvidenceLabel kind={kind}>{grade ?? "Grade not recorded"}</EvidenceLabel>
      {grader ? (
        <span>
          graded by <b>{grader}</b>
        </span>
      ) : null}
      {source ? <CitationChip>{source}</CitationChip> : null}
      {varies ? <span className="zq-grade-varies">· Graded differently by other scholars</span> : null}
    </span>
  );
}

/** Era tag with its certainty mark. */
export function EraTag({ label, certainty }: { label: string; certainty: EraCertainty }) {
  return (
    <span className={`zq-era zq-era-${certainty}`} data-certainty={certainty}>
      <span className="zq-era-mark" aria-hidden="true" />
      <span>{label}</span>
      <span className="zq-era-kind">· {ERA_TEXT[certainty]}</span>
    </span>
  );
}

export type EditorialState = "draft" | "in_review" | "approved" | "published" | "correction" | "rejected";
const STATUS_TEXT: Record<EditorialState, string> = {
  draft: "Draft",
  in_review: "In scholarly review",
  approved: "Approved",
  published: "Published",
  correction: "Correction pending",
  rejected: "Changes requested",
};

/** Workflow state. The word is always shown; the dot fill repeats it for colour-blind readers. */
export function EditorialStatus({ status, children }: { status: EditorialState; children?: ReactNode }) {
  return (
    <span className={`zq-status zq-status-${status}`} data-status={status}>
      <span className="zq-status-dot" aria-hidden="true" />
      {children ?? STATUS_TEXT[status]}
    </span>
  );
}

/** The visible draft badge for content that has not passed scholarly review. */
export function DraftBadge({ status }: { status: string }) {
  if (status === "published" || status === "approved") return null;
  return (
    <span data-testid="draft-badge">
      <EditorialStatus status="in_review">Draft content — pending scholarly review</EditorialStatus>
    </span>
  );
}

export function DemoTag() {
  return <span className="zq-demo">DEMO</span>;
}
