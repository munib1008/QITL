/**
 * The data behind the per-ayah Study panel. Shapes are plain JSON so the API route can return them as-is.
 * Text fields are filled only when the edition is verified AND its source licence is cleared (the database's RLS
 * enforces the same rule; src/lib/interpretation/state.ts drops text defensively as well).
 */

export type SlotState = "shown" | "licence_pending" | "not_imported" | "unverified";
export type EditionKind = "quran_translation" | "tafsir" | "early_tafsir" | "hadith_translation" | "hadith_commentary";
export type RightsStatus = "unknown" | "requested" | "cleared" | "denied" | "public_domain";
export type TafsirFlag = "weak_narration" | "israiliyyat" | "disputed" | "unattributed";
export type DifferenceKind = "translation_choice" | "linguistic" | "grammatical" | "exegetical";
export type CheckKey = "arabic_source" | "references" | "licensing" | "attribution" | "grammar" | "hadith_grading" | "sunni_scholarly" | "language_quality";

export interface Licence {
  work: string | null;
  rightsStatus: RightsStatus;
  text: string | null;
  url: string | null;
  attribution: string | null;
}

export interface EditionInfo {
  id: string;
  kind: EditionKind;
  language: string;
  title: string;
  titleAr: string | null;
  translator: { name: string; nameAr: string | null; died: string | null } | null;
  year: number | null;
  edition: string | null;
  origin: string;
  registryStatus: "candidate" | "verified" | "rejected";
  reliabilityNote: string | null;
  historicalPeriod: string | null;
  position: number | null;
  licence: Licence | null;
}

export interface TranslationSlot {
  edition: EditionInfo;
  state: SlotState;
  text: string | null;
}

export interface TafsirSlot {
  edition: EditionInfo;
  state: SlotState;
  text: string | null;
  flags: TafsirFlag[];
  reviewNote: string | null;
  range: { from: number; to: number } | null;
}

/** The 11th slot: Tafsir Muqatil ibn Sulayman, kept apart from translations. Edition is null until registered. */
export interface EarlyTafsirSlot {
  edition: EditionInfo | null;
  state: SlotState;
  text: string | null;
  flags: TafsirFlag[];
  reviewNote: string | null;
}

export interface WordItem {
  wordNo: number;
  textAr: string;
  transliteration: string | null;
  root: string | null;
  lemma: string | null;
  pos: string;
  features: Record<string, string>;
  literalGloss: string | null;
  sense: { rootMeaning: string | null; contextualMeaning: string; explanation: string | null } | null;
  occurrences: Array<{ surah: number; ayah: number; word: number }>;
}

export interface DifferenceItem {
  id: string;
  kind: DifferenceKind;
  termAr: string | null;
  wordNo: number | null;
  summary: string;
  recognised: boolean;
  editions: string[];
}

export interface HadithGradingView {
  grader: string;
  grade: string;
  label: string;
  citation: string;
  authentic: boolean;
}

export interface HadithRef {
  collectionId: string;
  collectionName: string;
  number: string;
  numbering: string;
  gradings: HadithGradingView[];
  presentedAsSahih: boolean;
}

export interface ExplanationItem {
  id: string;
  title: string;
  bodyMd: string;
  origin: "human" | "ai_assisted";
  model: string | null;
  promptVersion: string | null;
  version: number;
  language: string;
}

export interface RelatedItem {
  id: string;
  name: string;
}

export interface StudyData {
  ref: { surah: number; ayah: number };
  configured: boolean;
  translations: TranslationSlot[];
  earlyTafsir: EarlyTafsirSlot;
  words: WordItem[];
  wordsSource: Licence | null;
  differences: DifferenceItem[];
  tafsir: TafsirSlot[];
  hadith: HadithRef[];
  explanations: ExplanationItem[];
}

export const MAX_TRANSLATIONS = 10;
