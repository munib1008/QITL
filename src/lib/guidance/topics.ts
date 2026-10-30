/**
 * Life Guidance: shared types and pure helpers (no I/O), used by the loaders, the pages and the tests.
 * PLANNED_TOPICS mirrors the draft rows of supabase/migrations/20261031001960_life_guidance_topics.sql: titles and
 * icons only. It never carries lesson text, verses or advice; it lets the site show which topics are in preparation
 * (and the safety guidance on distress topics) before anything is published.
 */
import type { EvidenceKind } from "@/content/labels";

export const ICON_KEYS = ["wave", "bond", "leaf", "scale", "flame", "return", "moon", "lantern", "shield", "home", "hourglass", "star"] as const;
export type GuidanceIcon = (typeof ICON_KEYS)[number];

export interface PlannedTopic {
  slug: string;
  title_en: string;
  title_ar: string;
  icon_key: GuidanceIcon;
  distress: boolean;
}

export const PLANNED_TOPICS: PlannedTopic[] = [
  { slug: "feeling-overwhelmed", title_en: "Feeling overwhelmed", title_ar: "الشعور بالإرهاق", icon_key: "wave", distress: true },
  { slug: "betrayal-and-forgiveness", title_en: "Betrayal and forgiveness", title_ar: "الخيانة والعفو", icon_key: "bond", distress: false },
  { slug: "illness-and-hardship", title_en: "Illness and hardship", title_ar: "المرض والشدة", icon_key: "leaf", distress: true },
  { slug: "financial-difficulty", title_en: "Financial difficulty", title_ar: "الضيق المالي", icon_key: "scale", distress: true },
  { slug: "anger-and-conflict", title_en: "Anger and conflict", title_ar: "الغضب والخلاف", icon_key: "flame", distress: false },
  { slug: "feeling-guilty", title_en: "Feeling guilty", title_ar: "الشعور بالذنب", icon_key: "return", distress: true },
  { slug: "grief-and-loss", title_en: "Grief and loss", title_ar: "الحزن والفقد", icon_key: "moon", distress: true },
  { slug: "fear-and-anxiety", title_en: "Fear and anxiety", title_ar: "الخوف والقلق", icon_key: "shield", distress: true },
  { slug: "family-difficulties", title_en: "Family difficulties", title_ar: "الخلافات الأسرية", icon_key: "home", distress: false },
  { slug: "waiting-and-patience", title_en: "Waiting and patience", title_ar: "الانتظار والصبر", icon_key: "hourglass", distress: false },
];

export const SLUG_RE = /^[a-z0-9-]{2,60}$/;

export function plannedTopic(slug: string): PlannedTopic | undefined {
  return PLANNED_TOPICS.find((t) => t.slug === slug);
}

export function isIconKey(v: string): v is GuidanceIcon {
  return (ICON_KEYS as readonly string[]).includes(v);
}

export interface GuidanceTopic extends PlannedTopic {
  id: string;
  summary_en: string | null;
  summary_ar: string | null;
  position: number;
  version: number;
  updated_at: string;
}

export interface ClaimRef {
  kind: "quran" | "hadith" | "tafsir" | "history" | "scholar";
  quran_surah: number | null;
  quran_ayah_from: number | null;
  quran_ayah_to: number | null;
  locator: string | null;
  hadith_entries: { collection_id: string; canonical_number: string } | null;
  hadith_gradings: { grader: string; grade_label: string } | null;
  sources: { work: string } | null;
}

export interface LessonClaim {
  id: string;
  layer: "revelation" | "scholarly_interpretation";
  scholar_name: string | null;
  work_title: string | null;
  locator: string | null;
  position: number;
  evidence_claims: { id: string; statement: string; evidence: EvidenceKind; claim_references: ClaimRef[] } | null;
}

export interface GuidanceLesson {
  id: string;
  position: number;
  title_en: string;
  title_ar: string | null;
  application_en: string;
  application_ar: string | null;
  version: number;
  guidance_lesson_claims: LessonClaim[];
}

export type LinkKind = "person" | "event" | "story" | "creation";
export interface GuidanceLinkRow {
  id: string;
  target_kind: LinkKind;
  note_en: string | null;
  note_ar: string | null;
  position: number;
  people: { slug: string; name_en: string; name_ar: string; kind: string } | null;
  historical_events: { slug: string; title: string; title_ar: string | null } | null;
  stories: { slug: string; title: string; title_ar: string | null } | null;
  creation_profiles: { slug: string; name_en: string; name_ar: string } | null;
}

export interface SafetyNote {
  id: string;
  kind: "medical" | "mental_health" | "crisis" | "ruling_referral";
  body_en: string;
  body_ar: string | null;
  position: number;
}

export interface TopicPage {
  topic: GuidanceTopic;
  lessons: GuidanceLesson[];
  links: GuidanceLinkRow[];
  safety: SafetyNote[];
}

/** A visible citation for one reference: its label and, where QITL has a page for it, a link. */
export function citation(r: ClaimRef): { kind: string; label: string; href?: string } {
  if (r.kind === "quran" && r.quran_surah && r.quran_ayah_from) {
    const to = r.quran_ayah_to && r.quran_ayah_to !== r.quran_ayah_from ? `–${r.quran_ayah_to}` : "";
    return { kind: "Quran", label: `Q ${r.quran_surah}:${r.quran_ayah_from}${to}`, href: `/quran/${r.quran_surah}#ayah-${r.quran_ayah_from}` };
  }
  if (r.kind === "hadith" && r.hadith_entries) {
    const { collection_id: c, canonical_number: n } = r.hadith_entries;
    return { kind: "Hadith", label: `${c} ${n}`, href: `/hadith/${c}/${n}` };
  }
  const work = r.sources?.work ?? "Source";
  return { kind: r.kind === "tafsir" ? "Tafsir" : r.kind === "history" ? "History" : "Scholar", label: r.locator ? `${work}, ${r.locator}` : work };
}

/** Where a related link goes. People link only when they are prophets (QITL has a page for each prophet). */
export function linkTarget(l: GuidanceLinkRow, locale: "en" | "ar" | "ur"): { label: string; href?: string } | null {
  const ar = locale === "ar";
  if (l.target_kind === "person" && l.people)
    return { label: ar ? l.people.name_ar : l.people.name_en, href: l.people.kind === "prophet" ? `/prophets/${l.people.slug}` : undefined };
  if (l.target_kind === "event" && l.historical_events) return { label: (ar && l.historical_events.title_ar) || l.historical_events.title, href: `/events/${l.historical_events.slug}` };
  if (l.target_kind === "story" && l.stories) return { label: (ar && l.stories.title_ar) || l.stories.title, href: `/stories/${l.stories.slug}` };
  if (l.target_kind === "creation" && l.creation_profiles) return { label: ar ? l.creation_profiles.name_ar : l.creation_profiles.name_en, href: `/creation/${l.creation_profiles.slug}` };
  return null; // the target is not published (RLS hid it): show nothing rather than a dead link
}

/** Split a lesson's claims into the two evidence layers, each in editorial order. */
export function layersOf(lesson: GuidanceLesson) {
  const sorted = [...lesson.guidance_lesson_claims].filter((c) => c.evidence_claims).sort((a, b) => a.position - b.position);
  return {
    revelation: sorted.filter((c) => c.layer === "revelation"),
    scholarly: sorted.filter((c) => c.layer === "scholarly_interpretation" && c.scholar_name && c.work_title),
  };
}

/** Distress topics always show the safety guidance, whatever is published. */
export function needsSafetyNotice(topic: { distress: boolean } | undefined): boolean {
  return Boolean(topic?.distress);
}
