import { verificationState, type VerificationState } from "@/lib/verification/model";
import { isRated, pick3, type Assessed, type Discipline, type EvidenceState, type InterpretationStrength, type MilestoneDoc, type ReviewStatus, type Relationship, type TopicListItem } from "./model";

/**
 * The label a topic carries. VERIFIED only when the topic is published, which the database allows only after BOTH separate
 * reviews (scientific and scholarly) of the current version by two different appointed people, and nothing is flagged for
 * re-review. Anything else is a draft label. Rejection by either reviewer shows as Rejected.
 */
export function scienceVerification(t: { published: boolean; scholarly_status: ReviewStatus; scientific_review: ReviewStatus; ai_generated: boolean; needs_rereview?: boolean }): VerificationState {
  const both = t.published && t.scholarly_status === "approved" && t.scientific_review === "approved" && !t.needs_rereview;
  const rejected = t.scholarly_status === "rejected" || t.scientific_review === "rejected";
  return verificationState({
    aiAssisted: t.ai_generated,
    humanApprovalRecorded: both,
    reviewerIsAppointedPerson: both,
    reviewDecision: rejected ? "rejected" : null,
  });
}

/** What each separate review currently says, for the two lines on a page. */
export function reviewLines(t: { scholarly_status: ReviewStatus; scientific_review: ReviewStatus }): { scientific: ReviewStatus; scholarly: ReviewStatus } {
  return { scientific: t.scientific_review, scholarly: t.scholarly_status };
}

/** A year is shown only with its verified source; otherwise the page says "Not yet verified". Never a guess. */
export function displayYear(m: Pick<MilestoneDoc, "year" | "verified_source">): { year: number | null; sourceUrl: string | null } {
  if (m.year != null && m.verified_source && /^https?:\/\//.test(m.verified_source)) return { year: m.year, sourceUrl: m.verified_source };
  return { year: null, sourceUrl: null };
}

/** The earliest milestone whose year is verified, for the hub card. */
export function firstVerifiedMilestone(ms: MilestoneDoc[]): MilestoneDoc | null {
  const dated = ms.filter((m) => displayYear(m).year != null).sort((a, b) => (a.year as number) - (b.year as number));
  return dated[0] ?? null;
}

export interface TopicFilter {
  q?: string;
  discipline?: Discipline | "";
  relationship?: Relationship | "";
  evidence?: EvidenceState | "unassessed" | "";
  interpretation?: InterpretationStrength | "unassessed" | "";
}

const norm = (s: string) => s.normalize("NFKD").replace(/[ً-ٰٟۖ-ۭ]/g, "").toLowerCase();

/** Filter and search the hub. A filter value of 'unassessed' selects topics where nothing has been rated yet. */
export function filterTopics(list: TopicListItem[], f: TopicFilter, locale: string): TopicListItem[] {
  const q = f.q ? norm(f.q.trim()) : "";
  return list.filter((t) => {
    if (f.discipline && t.discipline !== f.discipline) return false;
    if (f.relationship && !t.links.some((l) => l.relationship === f.relationship)) return false;
    if (f.evidence) {
      const states = t.evidence_states.length ? t.evidence_states : (["unassessed"] as Array<Assessed<EvidenceState>>);
      if (!states.includes(f.evidence)) return false;
    }
    if (f.interpretation && !t.links.some((l) => l.interpretation_strength === f.interpretation)) return false;
    if (q) {
      const hay = norm([pick3(t.title, locale), t.title.en, t.title.ar, t.title.ur, t.summary ?? "", t.discipline, ...t.links.map((l) => `${l.surah}:${l.ayah}`)].join(" "));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** A short reference such as "51:47" or "55:19-20; 25:53". */
export function refLabel(links: Array<{ surah: number; ayah: number }>): string {
  const bySurah = new Map<number, number[]>();
  for (const l of links) bySurah.set(l.surah, [...(bySurah.get(l.surah) ?? []), l.ayah]);
  return [...bySurah.entries()]
    .map(([s, a]) => {
      const sorted = [...a].sort((x, y) => x - y);
      return sorted.length > 1 && sorted[sorted.length - 1]! - sorted[0]! === sorted.length - 1 ? `${s}:${sorted[0]}-${sorted[sorted.length - 1]}` : `${s}:${sorted.join(",")}`;
    })
    .join("; ");
}

export { isRated };
