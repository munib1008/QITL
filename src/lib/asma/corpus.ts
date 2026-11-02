import { hasArabicLetter, normalizeArabic, NORMALISATION_POLICY_VERSION } from "./normalize";

/**
 * The Quran corpus as the counting engine sees it: the pinned Tanzil Uthmani text parsed into verses and word tokens.
 * Tokenisation policy `asma-tok-v1`:
 *  - a token is a maximal run of non-space characters of the verse text as published (space, NBSP, ZWSP separate);
 *  - a token whose normalised form has no Arabic letter (a stop sign, the sajdah sign, the rub-el-hizb sign) is not a word
 *    and is dropped, so token indexes count words only;
 *  - token index is 1-based within the verse, counting words only;
 *  - this text file carries the basmala at the start of the first ayah of surahs 2-8 and 10-114 (it is not part of those
 *    ayahs; only 1:1 is the basmala as a verse). Those four leading words are tagged `basmalaPrefix`, get index 0 and are
 *    NEVER counted by any measure. A basmala inside a verse (27:30) is part of the verse and is counted.
 */
export const TOKENISATION_POLICY_VERSION = "asma-tok-v1";

export interface Token {
  /** 1-based word index inside the verse; 0 for a basmala prefix word. */
  index: number;
  /** The word exactly as published. */
  raw: string;
  normalized: string;
  basmalaPrefix: boolean;
}

export interface Verse {
  surah: number;
  ayah: number;
  text: string;
}

export interface CorpusEdition {
  source: string;
  version: string;
  /** sha256 of the pinned file as recorded in content/quran/source.json */
  sha256: string;
  /** sha256 of the verse list as the engine read it (surah|ayah|text lines) */
  contentSha256: string;
}

export interface Corpus {
  edition: CorpusEdition;
  verses: Verse[];
}

const BASMALA = ["بسم", "الله", "الرحمان", "الرحيم"];
const BASMALA_ALT = ["بسم", "الله", "الرحمن", "الرحيم"];

export function parseQuranText(text: string): Verse[] {
  const out: Verse[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const m = /^(\d{1,3})\|(\d{1,3})\|(.+)$/.exec(line);
    if (!m) throw new Error(`corpus: malformed line: ${line.slice(0, 40)}`);
    out.push({ surah: Number(m[1]), ayah: Number(m[2]), text: m[3]! });
  }
  return out;
}

export function tokenizeVerse(v: Verse): Token[] {
  const words = v.text
    .split(/[\s ​]+/)
    .filter(Boolean)
    .map((raw) => ({ raw, normalized: normalizeArabic(raw) }))
    .filter((w) => hasArabicLetter(w.normalized));
  const first4 = words.slice(0, 4).map((w) => w.normalized);
  const prefixed =
    v.ayah === 1 && v.surah !== 1 && v.surah !== 9 && words.length > 4 &&
    (first4.every((w, i) => w === BASMALA[i]) || first4.every((w, i) => w === BASMALA_ALT[i]));
  const out: Token[] = [];
  let i = 0;
  words.forEach((w, k) => {
    if (prefixed && k < 4) out.push({ index: 0, raw: w.raw, normalized: w.normalized, basmalaPrefix: true });
    else out.push({ index: ++i, raw: w.raw, normalized: w.normalized, basmalaPrefix: false });
  });
  return out;
}

/** Deterministic string for hashing the corpus content as read. */
export function canonicalCorpusText(verses: Verse[]): string {
  return verses.map((v) => `${v.surah}|${v.ayah}|${v.text}`).join("\n");
}

export const ENGINE_VERSIONS = { normalisation: NORMALISATION_POLICY_VERSION, tokenisation: TOKENISATION_POLICY_VERSION } as const;
