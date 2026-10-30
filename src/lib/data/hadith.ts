/**
 * The public hadith catalogue: four Sunni collections — Sahih al-Bukhari, Sahih Muslim, Jami' at-Tirmidhi and Sunan
 * Ibn Majah (the same four the database accepts as evidence, migration 20261030001100). This is a catalogue, not a
 * grade: each narration is graded on its own by a named scholar. Bukhari and Muslim carry a collection-level note
 * and their narrations still show gradings; a Tirmidhi or Ibn Majah narration is presented as sahih only when a
 * recorded grading of that narration says sahih.
 */
export type CollectionId = "bukhari" | "muslim" | "tirmidhi" | "ibnmajah";

export interface Collection {
  id: CollectionId;
  name: string;
  arabic: string;
  compiler: string;
  note: string;
  /** True only for the two Sahih collections; it describes the compiler's aim, never a grade of a narration. */
  sahihCollection: boolean;
}

const MIXED =
  "Contains narrations of differing grades. A narration from this collection is presented as sahih only when a named scholar's recorded grading of that narration says so; every grading is shown.";

export const COLLECTIONS: Collection[] = [
  { id: "bukhari", name: "Sahih al-Bukhari", arabic: "صحيح البخاري", compiler: "Muhammad ibn Ismail al-Bukhari", sahihCollection: true, note: "Compiled with the aim of including only authentic narrations; the scholarly consensus on its status is shown as context, and each narration still shows its gradings." },
  { id: "muslim", name: "Sahih Muslim", arabic: "صحيح مسلم", compiler: "Muslim ibn al-Hajjaj", sahihCollection: true, note: "Compiled with the aim of including only authentic narrations; the scholarly consensus on its status is shown as context, and each narration still shows its gradings." },
  { id: "tirmidhi", name: "Jami' at-Tirmidhi", arabic: "جامع الترمذي", compiler: "Muhammad ibn Isa at-Tirmidhi", sahihCollection: false, note: MIXED },
  { id: "ibnmajah", name: "Sunan Ibn Majah", arabic: "سنن ابن ماجه", compiler: "Muhammad ibn Yazid Ibn Majah", sahihCollection: false, note: MIXED },
];

export const COLLECTION_IDS = COLLECTIONS.map((c) => c.id) as [CollectionId, ...CollectionId[]];

export const collectionById = (id: string) => COLLECTIONS.find((c) => c.id === id);

/** Grades the database counts as authentic (public.grade_is_authentic). */
export const AUTHENTIC_GRADES: ReadonlySet<string> = new Set(["sahih", "hasan", "hasan sahih", "sahih li-ghayrihi", "hasan li-ghayrihi"]);
/** Grades that say "sahih" (a hasan grade is authentic but is not presented as sahih). */
export const SAHIH_GRADES: ReadonlySet<string> = new Set(["sahih", "hasan sahih", "sahih li-ghayrihi"]);

/**
 * Whether a narration may be presented as sahih. Never from the collection's name: only from a recorded grading by a
 * named scholar that says sahih. For Tirmidhi and Ibn Majah this is the only route; the same rule is applied to
 * Bukhari and Muslim so a missing grading is never papered over by the collection's reputation.
 */
export function presentedAsSahih(_collection: string, gradings: Array<{ grade: string; grader: string }>): boolean {
  return gradings.some((g) => g.grader.trim().length > 1 && SAHIH_GRADES.has(g.grade));
}
