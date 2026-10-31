"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { EraCertainty, EvidenceKind } from "@/content/labels";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";
import { EvidenceMark } from "./icons";

/*
 * Client components so their words follow the interface language (useLocale reads the [locale] segment) wherever they
 * are rendered, from a server page or a client island. An explicit lang/locale prop wins.
 */

export interface EvidenceLabelProps {
  kind: EvidenceKind;
  /** Interface language of the label; defaults to the page's. */
  lang?: string;
  title?: string;
  children?: ReactNode;
}

/** What kind of knowledge a claim rests on: word + mark + border style, never colour alone. Always visible. */
export function EvidenceLabel({ kind, lang, title, children }: EvidenceLabelProps) {
  const page = useLocale();
  const t = uiStrings(lang ?? page);
  return (
    <span className={`zq-ev zq-ev-${kind}`} title={title} data-evidence={kind}>
      <EvidenceMark kind={kind} />
      <span>{children ?? t.evidence[kind]}</span>
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
  const t = uiStrings(useLocale());
  const kind: EvidenceKind = authentic && grader ? "hadith" : grade ? "scholar" : "unknown";
  return (
    <span className="zq-grade">
      <EvidenceLabel kind={kind}>{grade ?? t.grade.notRecorded}</EvidenceLabel>
      {grader ? (
        <span>
          {t.grade.gradedBy} <b>{grader}</b>
        </span>
      ) : null}
      {source ? <CitationChip>{source}</CitationChip> : null}
      {varies ? <span className="zq-grade-varies">{t.grade.varies}</span> : null}
    </span>
  );
}

/** Era tag with its certainty mark. */
export function EraTag({ label, certainty }: { label: string; certainty: EraCertainty }) {
  const t = uiStrings(useLocale());
  return (
    <span className={`zq-era zq-era-${certainty}`} data-certainty={certainty}>
      <span className="zq-era-mark" aria-hidden="true" />
      <span>{label}</span>
      <span className="zq-era-kind">· {t.era[certainty]}</span>
    </span>
  );
}

export type EditorialState = "draft" | "in_review" | "approved" | "published" | "correction" | "rejected";
/** Workflow state. The word is always shown; the dot fill repeats it for colour-blind readers. */
export function EditorialStatus({ status, children }: { status: EditorialState; children?: ReactNode }) {
  const t = uiStrings(useLocale());
  return (
    <span className={`zq-status zq-status-${status}`} data-status={status}>
      <span className="zq-status-dot" aria-hidden="true" />
      {children ?? t.status[status]}
    </span>
  );
}

/** The visible draft badge for content that has not passed scholarly review. */
export function DraftBadge({ status }: { status: string }) {
  const t = uiStrings(useLocale());
  if (status === "published" || status === "approved") return null;
  return (
    <span data-testid="draft-badge">
      <EditorialStatus status="in_review">{t.draftContent}</EditorialStatus>
    </span>
  );
}

export function DemoTag() {
  return <span className="zq-demo">{uiStrings(useLocale()).demo}</span>;
}
