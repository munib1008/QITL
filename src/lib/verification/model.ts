/**
 * The universal verification model: what a reader is told about how far a piece of content has been checked.
 *
 * Publication, verification, licensing and technical completion are SEPARATE facts. This module only answers the display
 * question "which label does this content carry?" from facts that are recorded elsewhere. The one rule it enforces:
 * VERIFIED is reachable only through a recorded, qualified human review. Nothing an AI, an automated check or an editor's
 * decision to publish a draft can produce ever yields VERIFIED.
 */
export const VERIFICATION_STATES = [
  "verified",
  "pending_verification",
  "ai_assisted_draft",
  "historical_estimate",
  "disputed",
  "source_unavailable",
  "rejected",
  "withdrawn",
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

/** Visual tone, kept to a few semantics so the badge is consistent everywhere (never colour alone: the label is always text). */
export type VerificationTone = "ok" | "caution" | "info" | "blocked";
export const STATE_TONE: Record<VerificationState, VerificationTone> = {
  verified: "ok",
  pending_verification: "caution",
  ai_assisted_draft: "caution",
  historical_estimate: "info",
  disputed: "info",
  source_unavailable: "blocked",
  rejected: "blocked",
  withdrawn: "blocked",
};

/** Whether a state may be shown as available guidance. Rejected and withdrawn content is never active. */
export const isActiveState = (s: VerificationState): boolean => s !== "rejected" && s !== "withdrawn";

export interface VerificationFacts {
  /** The content is AI-written or AI-assisted. */
  aiAssisted: boolean;
  /** A qualified human reviewer's approval is recorded for THIS version (editorial_reviews, version-bound, no self-review). */
  humanApprovalRecorded: boolean;
  /** The reviewer is a real, appointed role holder (the review row exists in the database; never an AI identity). */
  reviewerIsAppointedPerson: boolean;
  /** Review status recorded by a reviewer. */
  reviewDecision?: "changes_requested" | "rejected" | "invalidated" | null;
  /** Source text is not displayable (licence, import or provider limit). */
  sourceUnavailable?: boolean;
  /** Material disagreement between scholars or sources is recorded. */
  disputed?: boolean;
  /** A historians' estimate rather than a stated fact. */
  historicalEstimate?: boolean;
  /** Withdrawn after a problem was identified. */
  withdrawn?: boolean;
}

/**
 * The label content carries. Order matters: withdrawal and rejection win, then a missing source, then VERIFIED (only with a
 * recorded human approval by an appointed person), then dispute and estimate, then the draft labels.
 */
export function verificationState(f: VerificationFacts): VerificationState {
  if (f.withdrawn) return "withdrawn";
  if (f.reviewDecision === "rejected") return "rejected";
  if (f.sourceUnavailable) return "source_unavailable";
  if (f.humanApprovalRecorded && f.reviewerIsAppointedPerson && !f.reviewDecision) {
    return f.disputed ? "disputed" : "verified";
  }
  if (f.disputed) return "disputed";
  if (f.historicalEstimate) return "historical_estimate";
  return f.aiAssisted ? "ai_assisted_draft" : "pending_verification";
}

/** The three ways a piece of content can be reviewed; each has its own reviewer pathway and its own disclosure. */
export type ReviewKind = "scholarly" | "scientific" | "language";
