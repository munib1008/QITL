import { createHash } from "node:crypto";
import { canonicalCorpusText, ENGINE_VERSIONS, tokenizeVerse, type Corpus, type CorpusEdition } from "./corpus";
import { normalizeArabic } from "./normalize";

/**
 * The three counting measures. They are ALWAYS separate: there is no total anywhere in this module, and a reviewer-facing
 * page that adds them together is a defect.
 *
 *  A  exact surface form   a word whose normalised letters equal one of the Name's registered surface forms. Policy:
 *                          the definite article is part of the form (a registered "الغفور" does not match "غفور" and
 *                          a registered "غفور" does not match "الغفور"); a word with an attached prefix particle
 *                          ("وَٱللَّهُ", "لِلَّهِ") is a different surface form. Nothing is inferred: whether a form is
 *                          registered is a recorded decision (the registry's `surface_forms`).
 *                          A is LEXICAL. A word matching a Name's form may be used of someone other than Allah
 *                          (for example an adjective for a person); each occurrence therefore carries
 *                          `referent: "unreviewed"` until a reviewer records otherwise.
 *  B  accepted variants    words on an explicit, reviewed inclusion list (a prefixed or alternatively-spelt form a
 *                          reviewer accepted, with a basis and a review reference). The default list is EMPTY, so B is 0
 *                          until a reviewer adds entries.
 *  C  related root         words on an explicit reviewed list of forms sharing the Name's root. They are listed
 *                          separately, are never Divine Names, and are never merged into A or B.
 *
 * Every number is computed from the corpus on each call; none is stored in code. Results carry the Quran edition and
 * checksums, the normalisation / tokenisation policy versions and the query version + query hash.
 */
export const QUERY_VERSION = "asma-query-v1";

export type Measure = "A" | "B" | "C";

export interface AcceptedVariant {
  /** The word form, in any spelling (normalised by the engine). */
  form: string;
  /** Why a reviewer accepts it, in words. */
  basis: string;
  /** Reference to the review record that accepted it. */
  reviewRef: string;
}

export interface RelatedRootGroup {
  root: string;
  forms: string[];
}

export interface NameQuery {
  slug: string;
  /** Registered exact surface forms (A). Normalised by the engine. */
  surfaceForms: string[];
  /** Reviewer-accepted variants (B). Default: none. */
  acceptedVariants?: AcceptedVariant[];
  /** Reviewer-listed related-root forms (C). Default: none. */
  relatedRoots?: RelatedRootGroup[];
}

export interface Occurrence {
  surah: number;
  ayah: number;
  tokenIndex: number;
  measure: Measure;
  relation: "direct" | "related";
  /** The normalised form that matched. */
  matchedForm: string;
  /** The word as published (for highlighting). */
  raw: string;
  /** Lexical match only; whether the word refers to Allah is a reviewer's judgement. */
  referent: "unreviewed";
  /** C only */
  root?: string;
}

export interface Provenance {
  edition: CorpusEdition;
  normalisationPolicy: string;
  tokenisationPolicy: string;
  queryVersion: string;
  queryHash: string;
}

export interface MeasureResult {
  measure: Measure;
  count: number;
  /** distinct verses containing at least one occurrence */
  verseCount: number;
  occurrences: Occurrence[];
}

export interface NameCounts {
  slug: string;
  provenance: Provenance;
  A: MeasureResult;
  B: MeasureResult;
  C: MeasureResult;
}

export interface TokenHit {
  surah: number;
  ayah: number;
  index: number;
  raw: string;
}
export type CorpusIndex = {
  edition: CorpusEdition;
  byForm: Map<string, TokenHit[]>;
  /** words counted (basmala prefix words excluded) */
  wordCount: number;
  /** basmala prefix words skipped (never counted) */
  basmalaPrefixWords: number;
};

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function corpusContentSha256(corpus: Corpus): string {
  return sha256(canonicalCorpusText(corpus.verses));
}

/** Builds the word index once; every query reads it. Refuses a corpus whose content hash differs from its edition record. */
export function buildIndex(corpus: Corpus): CorpusIndex {
  if (corpusContentSha256(corpus) !== corpus.edition.contentSha256) throw new Error("corpus content does not match its recorded content checksum");
  const byForm = new Map<string, TokenHit[]>();
  let wordCount = 0;
  let basmalaPrefixWords = 0;
  for (const v of corpus.verses) {
    for (const t of tokenizeVerse(v)) {
      if (t.basmalaPrefix) {
        basmalaPrefixWords++;
        continue;
      }
      wordCount++;
      const arr = byForm.get(t.normalized);
      const hit = { surah: v.surah, ayah: v.ayah, index: t.index, raw: t.raw };
      if (arr) arr.push(hit);
      else byForm.set(t.normalized, [hit]);
    }
  }
  return { edition: corpus.edition, byForm, wordCount, basmalaPrefixWords };
}

/** Stable JSON: object keys sorted, arrays in order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}

export function normalizeQuery(q: NameQuery): NameQuery {
  const uniq = (xs: string[]) => [...new Set(xs.map((x) => normalizeArabic(x)).filter(Boolean))].sort();
  return {
    slug: q.slug,
    surfaceForms: uniq(q.surfaceForms),
    acceptedVariants: (q.acceptedVariants ?? []).map((v) => ({ form: normalizeArabic(v.form), basis: v.basis, reviewRef: v.reviewRef })).sort((a, b) => a.form.localeCompare(b.form)),
    relatedRoots: (q.relatedRoots ?? []).map((g) => ({ root: g.root, forms: uniq(g.forms) })).sort((a, b) => a.root.localeCompare(b.root)),
  };
}

export function queryHash(q: NameQuery): string {
  return sha256(canonicalJson({ v: QUERY_VERSION, q: normalizeQuery(q) }));
}

function result(measure: Measure, occurrences: Occurrence[]): MeasureResult {
  occurrences.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah || a.tokenIndex - b.tokenIndex);
  return { measure, count: occurrences.length, verseCount: new Set(occurrences.map((o) => `${o.surah}:${o.ayah}`)).size, occurrences };
}

export function countName(index: CorpusIndex, query: NameQuery): NameCounts {
  const q = normalizeQuery(query);
  const seen = new Set<string>();
  const key = (h: TokenHit) => `${h.surah}:${h.ayah}:${h.index}`;
  const collect = (forms: string[], measure: Measure, relation: "direct" | "related", root?: string): Occurrence[] => {
    const out: Occurrence[] = [];
    for (const form of forms) {
      for (const h of index.byForm.get(form) ?? []) {
        const k = key(h);
        if (seen.has(k)) continue; // a word is counted under ONE measure: A before B before C
        seen.add(k);
        out.push({ surah: h.surah, ayah: h.ayah, tokenIndex: h.index, measure, relation, matchedForm: form, raw: h.raw, referent: "unreviewed", ...(root ? { root } : {}) });
      }
    }
    return out;
  };
  const A = collect(q.surfaceForms, "A", "direct");
  const B = collect((q.acceptedVariants ?? []).map((v) => v.form), "B", "direct");
  const C: Occurrence[] = [];
  for (const g of q.relatedRoots ?? []) C.push(...collect(g.forms, "C", "related", g.root));
  return {
    slug: q.slug,
    provenance: {
      edition: index.edition,
      normalisationPolicy: ENGINE_VERSIONS.normalisation,
      tokenisationPolicy: ENGINE_VERSIONS.tokenisation,
      queryVersion: QUERY_VERSION,
      queryHash: queryHash(q),
    },
    A: result("A", A),
    B: result("B", B),
    C: result("C", C),
  };
}

/** Exploration only (never a measure): words equal to the form with the article toggled, or with one attached prefix particle. */
export function exploreCandidates(index: CorpusIndex, form: string): Array<{ kind: "article_toggled" | "prefixed"; form: string; hits: TokenHit[] }> {
  const f = normalizeArabic(form);
  const out: Array<{ kind: "article_toggled" | "prefixed"; form: string; hits: TokenHit[] }> = [];
  const add = (kind: "article_toggled" | "prefixed", cand: string) => {
    const hits = index.byForm.get(cand);
    if (hits?.length) out.push({ kind, form: cand, hits });
  };
  add("article_toggled", f.startsWith("ال") ? f.slice(2) : `ال${f}`);
  for (const p of ["و", "ف", "ب", "ل", "ك"]) add("prefixed", p + f);
  return out;
}

/** The three results as a stable string (the unit of reproducibility). */
export function serialiseCounts(c: NameCounts): string {
  return canonicalJson(c);
}

/** Recomputes from scratch (a fresh index) and checks the output is byte-identical to the first run. */
export function verifyReproducible(corpus: Corpus, query: NameQuery): { ok: boolean; sha256: string } {
  const a = serialiseCounts(countName(buildIndex(corpus), query));
  const b = serialiseCounts(countName(buildIndex(corpus), query));
  return { ok: a === b, sha256: sha256(a) };
}
