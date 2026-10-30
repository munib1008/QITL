// ZIQ component props — documentation for consumers (window.ZIQ). Not type-checked.
import * as React from "react";
export type EvidenceKind = "quran" | "hadith" | "scholar" | "estimate" | "disputed" | "unknown";
export type DatePrecision = "exact" | "range" | "estimated" | "relative" | "unknown";
export interface ButtonProps { variant?: "primary" | "secondary" | "quiet" | "danger"; size?: "md" | "sm"; icon?: "bookmark" | "copy" | "share" | "source" | "discuss" | "search" | "check"; loading?: boolean; disabled?: boolean; type?: "button" | "submit"; onClick?: () => void; children?: React.ReactNode; }
export interface EvidenceLabelProps { kind: EvidenceKind; lang?: "en" | "ar"; title?: string; children?: React.ReactNode; }
export interface CitationChipProps { kind?: string; href?: string; onClick?: () => void; ariaLabel?: string; children: React.ReactNode; }
export interface HadithGradeProps { grade?: string; grader?: string; source?: string; authentic?: boolean; varies?: boolean; }
export interface VerseCardProps { surahName: string; reference: string; arabic: string; translation?: string; translator?: string; edition?: string; licence?: "cleared" | "pending"; bookmarked?: boolean; demo?: boolean; actions?: boolean; onBookmark?: (saved: boolean) => void; onDiscuss?: () => void; }
export interface HadithCardProps { collection: string; number: string; numbering?: string; arabic?: string; translation?: string; gradings?: HadithGradeProps[]; demo?: boolean; actions?: boolean; onDiscuss?: () => void; }
export interface EventCardProps { title: string; category?: string; summary?: string; precision: DatePrecision; dateLabel?: string; start?: number; end?: number; place?: string; evidence?: EvidenceKind; references?: string[]; }
export interface ProphetCardProps { name: string; arabicName?: string; honorific?: string; order?: string; mentions?: string; href?: string; }
export interface MapLegendProps { title?: string; items?: Array<"point" | "region" | "unknown" | "hypothesis" | "route">; attribution: string; }
export interface GenealogyNodeData { name: string; generation?: string; current?: boolean; unknown?: boolean; onClick?: () => void; }
export interface GenealogyLinkProps { from: GenealogyNodeData; to: GenealogyNodeData; relation?: string; status?: "verified" | "disputed" | "unknown"; }
export interface EditorialStatusProps { status: "draft" | "in_review" | "approved" | "published" | "correction" | "rejected"; children?: React.ReactNode; }
export interface CommentProps { author: string; role?: string; time: string; body?: string; citation?: string; edited?: boolean; status?: "visible" | "hidden" | "removed"; onReport?: () => void; }
export interface TextFieldProps { label: string; id?: string; type?: string; placeholder?: string; value?: string; help?: string; error?: string; disabled?: boolean; dir?: "ltr" | "rtl" | "auto"; }
export interface SearchFieldProps { label?: string; placeholder?: string; value?: string; maxWidth?: number; }
export interface SkeletonProps { width?: number | string; height?: number; round?: boolean; }
export interface ToastProps { tone?: "info" | "success" | "error"; action?: string; onAction?: () => void; children: React.ReactNode; }
export interface EvidenceTab { label: string; count?: number; content: React.ReactNode; }
export interface EvidenceDrawerProps { claim: string; status?: EvidenceKind; tabs: EvidenceTab[]; footer?: React.ReactNode; onClose?: () => void; }
export interface TimelineItem { title: string; precision?: DatePrecision; dateLabel?: string; evidence?: EvidenceKind; selected?: boolean; onClick?: () => void; }
export interface TimelineEra { title: string; kind: "relative" | "dated" | "undated-future"; note?: string; items: TimelineItem[]; breakAfter?: string; }
export interface VerticalTimelineProps { eras: TimelineEra[]; today?: string | false; label?: string; }
export interface JourneySurah { number: number; name: string; arabic: string; passages: string[]; named?: boolean; }
export interface JourneyMilestone { when: string; text: string; certainty: "exact" | "estimate" | "traditional" | "unknown"; }
export interface ProphetJourneyCardProps { id: string; name: string; arabicName: string; honorific?: string; subtitle?: string;
  era: { label: string; certainty: "relative" | "estimate" | "traditional" | "exact" | "unknown" | "disputed" };
  ageMarker?: string; summary: string; milestones?: JourneyMilestone[]; surahs: JourneySurah[];
  place?: { name: string; certainty: "point" | "region" | "hypothesis" | "disputed" | "unknown" };
  evidence?: EvidenceKind[]; order?: { label: string; disputed?: boolean }; note?: string; points?: 8 | 10 | 12;
  expanded?: boolean; onToggle?: () => void; onExplore?: () => void; onEvidence?: () => void; }
export interface JourneyEra { title: string; note?: string; items: ProphetJourneyCardProps[]; }
export interface JourneyTimelineProps { eras: JourneyEra[]; intro?: React.ReactNode; initialActive?: string; scrollSync?: boolean; theme?: "journey" | "dark"; endLabel?: string | false; endActions?: React.ReactNode; label?: string; }
