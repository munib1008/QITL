/**
 * Learning journeys: the structure only. Five audiences, each a short list of steps pointing at pages that exist. A step whose
 * content has not been written is a placeholder that the page shows as "awaiting an author and a reviewer": nothing is invented.
 */
export const AUDIENCES = ["children", "teens", "general", "university", "advanced"] as const;
export type Audience = (typeof AUDIENCES)[number];

export type StepKey = "read_passage" | "see_evidence_states" | "history_of_discovery" | "limits" | "open_questions" | "primary_literature" | "method";

export interface JourneyStep {
  key: StepKey;
  /** a page that exists today, or null when the step is a placeholder */
  href: string | null;
  /** the step has written content that a reviewer has seen */
  written: boolean;
}

/** Only the steps that point at an existing page are `written: true` as navigation; the audience-specific writing is all pending. */
export const JOURNEYS: Record<Audience, JourneyStep[]> = {
  children: [
    { key: "read_passage", href: null, written: false },
    { key: "limits", href: null, written: false },
  ],
  teens: [
    { key: "read_passage", href: "/science", written: false },
    { key: "see_evidence_states", href: null, written: false },
    { key: "limits", href: null, written: false },
  ],
  general: [
    { key: "read_passage", href: "/science", written: false },
    { key: "see_evidence_states", href: "/science", written: false },
    { key: "history_of_discovery", href: "/science/timeline", written: false },
    { key: "open_questions", href: "/science/questions", written: false },
  ],
  university: [
    { key: "see_evidence_states", href: "/science", written: false },
    { key: "history_of_discovery", href: "/science/timeline", written: false },
    { key: "primary_literature", href: null, written: false },
    { key: "open_questions", href: "/science/questions", written: false },
  ],
  advanced: [
    { key: "method", href: "/methodology", written: false },
    { key: "primary_literature", href: null, written: false },
    { key: "history_of_discovery", href: "/science/timeline", written: false },
    { key: "open_questions", href: "/science/questions", written: false },
  ],
};

/** Placeholders awaiting content: the count the status table reports. */
export function pendingSteps(): number {
  return AUDIENCES.reduce((n, a) => n + JOURNEYS[a].filter((s) => !s.written).length, 0);
}
