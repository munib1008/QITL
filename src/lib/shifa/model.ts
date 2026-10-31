/**
 * Shifa: shared types and pure helpers (no I/O), used by the loaders, the pages, the editor and the tests.
 * PLANNED_TOPICS mirrors the draft rows of supabase/migrations/20261031002410_shifa_topics.sql: titles and icons only. It
 * never carries entry text, a remedy, a verse, a hadith or advice; a title is a navigation label, not a claim.
 *
 * The database enforces the evidence rules (supabase/migrations/20261031002400_shifa.sql); this module mirrors the few
 * the UI needs so it can show the right containers and explain what is missing.
 */

export type ShifaSection = "quranic_healing" | "ruqyah" | "prophetic_remedies" | "wellbeing";
export const SECTIONS: ReadonlyArray<{ key: ShifaSection; slug: string }> = [
  { key: "quranic_healing", slug: "quranic-healing" },
  { key: "ruqyah", slug: "ruqyah" },
  { key: "prophetic_remedies", slug: "prophetic-remedies" },
  { key: "wellbeing", slug: "wellbeing" },
];

export function sectionFromSlug(slug: string): ShifaSection | undefined {
  return SECTIONS.find((s) => s.slug === slug)?.key;
}
export function sectionSlug(key: ShifaSection): string {
  return SECTIONS.find((s) => s.key === key)!.slug;
}

export const ICON_KEYS = ["leaf", "vessel", "water", "light", "pattern", "calligraphy", "moon", "scale"] as const;
export type ShifaIcon = (typeof ICON_KEYS)[number];
export const isIconKey = (v: string): v is ShifaIcon => (ICON_KEYS as readonly string[]).includes(v);

export const SLUG_RE = /^[a-z0-9-]{2,60}$/;

export interface PlannedTopic {
  slug: string;
  section: ShifaSection;
  title_en: string;
  title_ar: string;
  icon_key: ShifaIcon;
}

/** Titles only; the Arabic is a first draft awaiting a qualified translator. */
export const PLANNED_TOPICS: PlannedTopic[] = [
  { slug: "quranic-healing", section: "quranic_healing", title_en: "Quranic healing", title_ar: "الشفاء بالقرآن", icon_key: "calligraphy" },
  { slug: "authentic-ruqyah", section: "ruqyah", title_en: "Authentic ruqyah", title_ar: "الرقية الشرعية", icon_key: "light" },
  { slug: "honey", section: "prophetic_remedies", title_en: "Honey", title_ar: "العسل", icon_key: "vessel" },
  { slug: "black-seed", section: "prophetic_remedies", title_en: "Black seed (Nigella sativa)", title_ar: "الحبة السوداء", icon_key: "leaf" },
  { slug: "dates", section: "prophetic_remedies", title_en: "Dates", title_ar: "التمر", icon_key: "leaf" },
  { slug: "olive-oil", section: "prophetic_remedies", title_en: "Olive oil", title_ar: "زيت الزيتون", icon_key: "vessel" },
  { slug: "water-and-zamzam", section: "prophetic_remedies", title_en: "Water and zamzam", title_ar: "الماء وزمزم", icon_key: "water" },
  { slug: "cupping-hijama", section: "prophetic_remedies", title_en: "Cupping (hijama)", title_ar: "الحجامة", icon_key: "vessel" },
  { slug: "sleep-and-rest", section: "prophetic_remedies", title_en: "Sleep and rest", title_ar: "النوم والراحة", icon_key: "moon" },
  { slug: "moderation-in-eating", section: "prophetic_remedies", title_en: "Moderation in eating", title_ar: "الاعتدال في الطعام", icon_key: "scale" },
  { slug: "cleanliness-and-hygiene", section: "prophetic_remedies", title_en: "Cleanliness and hygiene", title_ar: "النظافة والطهارة", icon_key: "water" },
  { slug: "grief-and-distress", section: "wellbeing", title_en: "Grief and distress", title_ar: "الحزن والكرب", icon_key: "moon" },
  { slug: "anxiety-and-worry", section: "wellbeing", title_en: "Anxiety and worry", title_ar: "القلق والهمّ", icon_key: "light" },
  { slug: "patience-in-illness", section: "wellbeing", title_en: "Patience in illness", title_ar: "الصبر على المرض", icon_key: "pattern" },
];

export const plannedTopic = (slug: string): PlannedTopic | undefined => PLANNED_TOPICS.find((t) => t.slug === slug);
export const plannedIn = (section: ShifaSection): PlannedTopic[] => PLANNED_TOPICS.filter((t) => t.section === section);

/**
 * The starting references, shown as references only, never quoted. Numbering differs between editions, so each is shown in
 * the "licence pending" style until it is checked against the licensed edition.
 */
export const REFERENCE_POINTS = [
  { kind: "quran", label: "Quran 17:82", href: "/quran/17#ayah-82" },
  { kind: "quran", label: "Quran 16:69", href: "/quran/16#ayah-69" },
  { kind: "hadith", label: "Sahih al-Bukhari 5736", href: "/hadith/bukhari/5736", plannedFor: "authentic-ruqyah" },
  { kind: "hadith", label: "Sahih al-Bukhari 5688", href: "/hadith/bukhari/5688", plannedFor: "black-seed" },
] as const;

export type EvidenceCategory = "A" | "B" | "C" | "D";
export type EntryKind = "practice" | "remedy" | "supplication" | "lesson" | "misconception" | "lifestyle";
export const ENTRY_KINDS: EntryKind[] = ["practice", "remedy", "supplication", "lesson", "misconception", "lifestyle"];
export type StudyType = "randomised_trial" | "systematic_review" | "meta_analysis" | "cohort" | "case_control" | "case_report" | "laboratory" | "animal" | "other";
export const STUDY_TYPES: StudyType[] = ["randomised_trial", "systematic_review", "meta_analysis", "cohort", "case_control", "case_report", "laboratory", "animal", "other"];
export type SafetyKind = "general" | "pregnancy_children" | "interactions" | "emergency" | "mental_health" | "crisis" | "ruling_referral";
export const SAFETY_KINDS: SafetyKind[] = ["general", "pregnancy_children", "interactions", "emergency", "mental_health", "crisis", "ruling_referral"];
export type Pathway = "religious" | "clinical";

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
export interface ClaimBlock {
  id: string;
  statement: string;
  evidence: "quran" | "hadith" | "scholar" | "estimate" | "disputed" | "unknown";
  claim_references: ClaimRef[];
}

export interface ShifaLayer {
  id: string;
  evidence_category: EvidenceCategory;
  position: number;
  finding: string | null;
  publication: string | null;
  citation: string | null;
  study_type: StudyType | null;
  population: string | null;
  limitations: string | null;
  url: string | null;
  states_health_effect: boolean;
  is_traditional: boolean;
  is_hypothesis: boolean;
  language: string;
  evidence_claims: ClaimBlock | null;
}

export interface ShifaScholarlyNote {
  id: string;
  scholar_name: string;
  work_title: string;
  locator: string | null;
  position: number;
  evidence_claims: ClaimBlock | null;
}

export interface ShifaEntry {
  id: string;
  slug: string;
  kind: EntryKind;
  title_en: string;
  title_ar: string | null;
  position: number;
  version: number;
  last_reviewed_at: string | null;
  shifa_layers: ShifaLayer[];
  shifa_scholarly_notes: ShifaScholarlyNote[];
}

export interface ShifaSafetyNote {
  id: string;
  entry_id: string | null;
  kind: SafetyKind;
  body_en: string;
  body_ar: string | null;
  position: number;
}

export interface ShifaTopic {
  id: string;
  slug: string;
  section: ShifaSection;
  title_en: string;
  title_ar: string | null;
  icon_key: ShifaIcon;
  position: number;
  version: number;
}

export interface TopicPage {
  topic: ShifaTopic;
  entries: ShifaEntry[];
  safety: ShifaSafetyNote[];
}

/** The four layers of an entry, each kept in its own list; scholarly notes are a fifth, separate list. */
export function splitLayers(entry: Pick<ShifaEntry, "shifa_layers" | "shifa_scholarly_notes">) {
  const sorted = [...entry.shifa_layers].sort((a, b) => a.position - b.position);
  const by = (c: EvidenceCategory) => sorted.filter((l) => l.evidence_category === c);
  return {
    A: by("A").filter((l) => l.evidence_claims),
    B: by("B").filter((l) => l.evidence_claims),
    C: by("C"),
    D: by("D"),
    scholarly: [...entry.shifa_scholarly_notes].filter((n) => n.evidence_claims).sort((a, b) => a.position - b.position),
  };
}

/** Which containers an entry page shows. Ruqyah rests only on the Quran, authentic hadith and named scholars. */
export function visibleLayers(section: ShifaSection): Array<"A" | "B" | "S" | "C" | "D"> {
  return section === "ruqyah" ? ["A", "B", "S"] : ["A", "B", "S", "C", "D"];
}

/** The whole wellbeing section carries the professional mental-health recommendation and the crisis note. */
export const needsMentalHealthNotice = (section: ShifaSection): boolean => section === "wellbeing";
export const needsRuqyahNotice = (section: ShifaSection): boolean => section === "ruqyah";

/** Recitation sits with the sections that rest on the Quran or on supplications (never with remedies or wellbeing research). */
export const showsRecitation = (section: ShifaSection, kind: EntryKind): boolean => section === "ruqyah" || section === "quranic_healing" || kind === "supplication";

export function citation(r: ClaimRef): { kind: string; label: string; href?: string } {
  if (r.kind === "quran" && r.quran_surah && r.quran_ayah_from) {
    const to = r.quran_ayah_to && r.quran_ayah_to !== r.quran_ayah_from ? `–${r.quran_ayah_to}` : "";
    const hash = r.quran_ayah_to && r.quran_ayah_to > r.quran_ayah_from ? `#ayah-${r.quran_ayah_from}-${r.quran_ayah_to}` : `#ayah-${r.quran_ayah_from}`;
    return { kind: "Quran", label: `Q ${r.quran_surah}:${r.quran_ayah_from}${to}`, href: `/quran/${r.quran_surah}${hash}` };
  }
  if (r.kind === "hadith" && r.hadith_entries) {
    const { collection_id: c, canonical_number: n } = r.hadith_entries;
    return { kind: "Hadith", label: `${c} ${n}`, href: `/hadith/${c}/${n}` };
  }
  const work = r.sources?.work ?? "Source";
  return { kind: r.kind === "tafsir" ? "Tafsir" : r.kind === "history" ? "History" : "Scholar", label: r.locator ? `${work}, ${r.locator}` : work };
}

export interface ShifaLinkRow {
  id: string;
  shifa_topics: { slug: string; section: ShifaSection; title_en: string; title_ar: string | null } | null;
}

/** Where a Shifa related-reading link goes. */
export function relatedHref(l: ShifaLinkRow): string | null {
  return l.shifa_topics ? `/shifa/${sectionSlug(l.shifa_topics.section)}/${l.shifa_topics.slug}` : null;
}
