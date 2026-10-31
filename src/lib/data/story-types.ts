/** Story types, constants and helpers shared by server pages and client components (no data access). */
import type { EvidenceKind } from "@/content/labels";
import { ayahHash } from "@/lib/refs";

export type Audience = "kids" | "young" | "full";
export const AUDIENCES: Array<[Audience, string, string]> = [
  ["kids", "Kids", "About 6–9: short sentences and simple lessons"],
  ["young", "Young learners", "About 10–15: more detail, quizzes and maps"],
  ["full", "Full story", "Older learners and adults: evidence, context and scholarly notes"],
];

export const FACT_KEYS = ["name_variants", "designation", "era", "lifespan", "age_at_events", "people_addressed", "time_among_people", "geography"] as const;
export type FactKey = (typeof FACT_KEYS)[number];
export const FACT_TITLE: Record<FactKey, string> = {
  name_variants: "Name variants",
  designation: "Prophet or Messenger",
  era: "Era or position",
  lifespan: "Total lifespan",
  age_at_events: "Age at significant events",
  people_addressed: "People addressed",
  time_among_people: "Time among his people",
  geography: "Geographical area",
};
export const STEP_ROLES = ["situation", "challenge", "action", "response", "outcome", "lesson"] as const;
export const STEP_TITLE: Record<(typeof STEP_ROLES)[number], string> = {
  situation: "Situation",
  challenge: "Challenge",
  action: "Action",
  response: "Response",
  outcome: "Outcome",
  lesson: "Lesson",
};
/** The fixed wording for anything the sources do not establish. */
export const NOT_ESTABLISHED = "Not established in the Quran or selected authentic Hadith.";

export interface Ref {
  kind: string;
  surah: number | null;
  from: number | null;
  to: number | null;
  hadith: { collection: string; number: string; grade: string | null; grader: string | null } | null;
  locator: string | null;
  work: string | null;
}

export interface Section {
  id: string;
  section: string;
  factKey: FactKey | null;
  stepGroup: number | null;
  stepRole: (typeof STEP_ROLES)[number] | null;
  position: number;
  audience: Audience;
  baseId: string | null;
  title: string | null;
  valueText: string | null;
  valueNote: string | null;
  known: boolean;
  bodyMd: string;
  everydayExample: string | null;
  evidence: EvidenceKind;
  refs: Ref[];
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string | null;
  refs: Ref[];
}
export interface Quiz {
  id: string;
  title: string;
  audience: Audience;
  questions: QuizQuestion[];
}
export interface Media {
  id: string;
  role: string;
  animationKey: string | null;
  caption: string;
  alt: string;
  imageUrl: string | null;
}

export interface Story {
  sections: Section[];
  quizzes: Quiz[];
  media: Media[];
}

/** The version of a full section for a reading level, falling back to the full text when no adaptation exists. */
export function forAudience(all: Section[], full: Section, audience: Audience): { section: Section; adapted: boolean } {
  if (audience === "full") return { section: full, adapted: true };
  const v = all.find((s) => s.baseId === full.id && s.audience === audience);
  return v ? { section: v, adapted: true } : { section: full, adapted: false };
}

const COLLECTION_NAME: Record<string, string> = { bukhari: "Bukhari", muslim: "Muslim", tirmidhi: "Tirmidhi", ibnmajah: "Ibn Majah" };

export function refLabel(r: Ref): { text: string; href?: string } {
  if (r.kind === "quran" && r.surah && r.from)
    return { text: `Q ${r.surah}:${r.from}${r.to && r.to !== r.from ? `–${r.to}` : ""}`, href: `/quran/${r.surah}${ayahHash(r.from, r.to)}` };
  if (r.kind === "hadith" && r.hadith)
    return { text: `${COLLECTION_NAME[r.hadith.collection] ?? r.hadith.collection} ${r.hadith.number}`, href: `/hadith/${r.hadith.collection}/${r.hadith.number}` };
  return { text: [r.work, r.locator].filter(Boolean).join(", ") || r.kind };
}
