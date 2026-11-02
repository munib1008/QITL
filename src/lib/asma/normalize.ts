/**
 * Arabic normalisation for COUNTING (never for display: the Quran text shown anywhere stays byte-for-byte what Tanzil
 * published). Policy version `asma-norm-v1`. Every rule is listed in NORMALISATION_RULES and pinned by a test.
 *
 *  1. Tatweel (kashida, U+0640) is removed.
 *  2. Dagger alef (U+0670, the Uthmani "small alef" that stands for a long a) is RESTORED to a full alef: the Uthmani
 *     spelling of the Name "As-Salam" then becomes the same letters as its ordinary spelling. A Name whose ordinary
 *     spelling omits that alef ("Ar-Rahman" is written without it) lists the alef-bearing spelling as an explicit
 *     orthographic form in the registry; the engine never guesses it.
 *  3. Diacritics (U+064B-U+065F: fathatan ... hamza below, shadda, sukun, maddah), Arabic extended marks
 *     (U+0610-U+061A), Quranic annotation signs and small high/low marks (U+06D6-U+06ED, including the small waw/ya, the
 *     Uthmani sukun and the stop signs), U+08D3-U+08FF, bidi/format characters and variation selectors are removed.
 *  4. Alef forms (alef with hamza above/below, alef with madda, alef wasla, wavy-hamza forms) become a plain alef.
 *     Hamza on waw (U+0624), hamza on ya (U+0626) and the bare hamza (U+0621) are KEPT: they are distinct letters.
 *  5. Alef maqsura (U+0649) and Persian ya (U+06CC) become ya (U+064A); Persian kaf (U+06A9) becomes kaf.
 *  6. Ta marbuta (U+0629) is KEPT by default (a feminine ending is not folded into ha); `taMarbuta: "to_ha"` folds it.
 *  7. The definite article is NOT touched here (see the article policy in count.ts).
 */
export const NORMALISATION_POLICY_VERSION = "asma-norm-v1";

export interface NormaliseOptions {
  /** Default "keep". "to_ha" folds U+0629 into U+0647 (exploration only; never used by the A measure). */
  taMarbuta?: "keep" | "to_ha";
}

export const NORMALISATION_RULES: readonly string[] = [
  "remove tatweel U+0640",
  "restore dagger alef U+0670 as alef U+0627",
  "remove diacritics U+064B-U+065F, U+0610-U+061A, Quranic marks U+06D6-U+06ED, U+08D3-U+08FF",
  "remove bidi/format characters (U+200B-U+200F, U+202A-U+202E, U+2066-U+2069, U+FEFF) and variation selectors",
  "fold alef forms U+0622 U+0623 U+0625 U+0671 U+0672 U+0673 U+0675 to U+0627",
  "keep hamza on waw U+0624, hamza on ya U+0626 and bare hamza U+0621",
  "fold alef maqsura U+0649 and Persian ya U+06CC to ya U+064A; Persian kaf U+06A9 to kaf U+0643",
  "keep ta marbuta U+0629 unless taMarbuta=to_ha",
];

const REMOVE = /[ـؐ-ًؚ-ٟۖ-ۭ࣓-ࣿ​-‏‪-‮⁦-⁩﻿︀-️]/g;

export function normalizeArabic(input: string, opts: NormaliseOptions = {}): string {
  let s = input.replace(/ٰ/g, "ا");
  s = s.replace(REMOVE, "");
  s = s.replace(/[آأإٱٲٳٵ]/g, "ا");
  s = s.replace(/[ىی]/g, "ي").replace(/ک/g, "ك");
  if (opts.taMarbuta === "to_ha") s = s.replace(/ة/g, "ه");
  return s;
}

/** The letters with every alef removed: used ONLY to suggest candidate spellings to a human reviewer, never to count. */
export function alefless(normalised: string): string {
  return normalised.replace(/ا/g, "");
}

const ARABIC_LETTER = /[ء-ي]/;
export function hasArabicLetter(s: string): boolean {
  return ARABIC_LETTER.test(s);
}
