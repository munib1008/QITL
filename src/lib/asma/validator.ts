import { countName, QUERY_VERSION, queryHash, type CorpusIndex, type Measure, type NameQuery, type Provenance } from "./count";
import { ENGINE_VERSIONS } from "./corpus";

/**
 * A count may be stored, shown or published only when it is derivable. The validator recomputes it from the corpus and
 * refuses anything else:
 *  - a count with no provenance (edition + checksums + policy versions + query hash) is "unsupported";
 *  - a count whose provenance differs from the engine's current edition / policy / query version is "stale";
 *  - a count that differs from the recomputed one is "mismatch";
 *  - a count whose origin is not "computed" (typed in by hand, copied from a book or a website) is "hardcoded".
 * findHardcodedCounts() scans registry data for count-like numeric fields, which the registry must never carry.
 */
export interface CountClaim {
  slug: string;
  measure: Measure;
  count: number;
  origin?: "computed" | "manual" | string;
  provenance?: Partial<Provenance> | null;
}

export type ClaimProblem = "hardcoded" | "unsupported" | "stale" | "mismatch" | "unknown_measure";

export function validateCountClaim(index: CorpusIndex, query: NameQuery, claim: CountClaim): { ok: boolean; problems: ClaimProblem[]; recomputed: number | null } {
  const problems: ClaimProblem[] = [];
  if (!["A", "B", "C"].includes(claim.measure)) return { ok: false, problems: ["unknown_measure"], recomputed: null };
  if (claim.origin !== "computed") problems.push("hardcoded");
  const p = claim.provenance;
  if (!p || !p.edition?.sha256 || !p.edition?.contentSha256 || !p.queryHash || !p.normalisationPolicy || !p.tokenisationPolicy || !p.queryVersion) problems.push("unsupported");
  else if (
    p.edition.sha256 !== index.edition.sha256 || p.edition.contentSha256 !== index.edition.contentSha256 ||
    p.normalisationPolicy !== ENGINE_VERSIONS.normalisation || p.tokenisationPolicy !== ENGINE_VERSIONS.tokenisation ||
    p.queryVersion !== QUERY_VERSION || p.queryHash !== queryHash(query)
  ) problems.push("stale");
  const recomputed = countName(index, query)[claim.measure].count;
  if (recomputed !== claim.count) problems.push("mismatch");
  return { ok: problems.length === 0, problems, recomputed };
}

const COUNT_KEY = /(^|_)(count|counts|total|times|occurrences|frequency|freq|n_?occ)(_|$)/i;

/** Paths of count-like numeric fields in registry data (a registry entry may not carry a count of any kind). */
export function findHardcodedCounts(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findHardcodedCounts(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => {
      const here = `${path}.${k}`;
      if (COUNT_KEY.test(k) && (typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v.trim())))) return [here];
      return findHardcodedCounts(v, here);
    });
  }
  return [];
}

/** A disputed candidate may be explored and counted, but never presented as a recognised Name. */
export function presentableAsRecognised(recognition: string): boolean {
  return recognition === "educational_list";
}
