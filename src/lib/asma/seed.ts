import { buildIndex, countName, queryHash, type CorpusIndex, type NameCounts } from "./count";
import { ENGINE_VERSIONS, type Corpus } from "./corpus";
import { QUERY_VERSION } from "./count";
import { buildQuery, surfaceFormsOf, validateRegistry, type NameDraft } from "./registry";
import { assertAsmaText } from "./text-validator";
import { findHardcodedCounts } from "./validator";

/**
 * Pure construction of everything the seed script writes: the current methodology, the draft Name rows, the occurrence
 * rows (from the engine) and the draft life-situation links. Nothing here touches a database or a file.
 */
export const SEED_PROMPT_VERSION = "asma-seed-v1";
export const SEED_AI_MODEL = "claude-sonnet-5-5";
export const METHODOLOGY_VERSION = `asma-count-v1`;

export interface TopicDraft {
  slug: string;
  position: number;
  en: string;
  ar: string;
  ur: string;
  names: string[];
}

export interface OccurrenceRow {
  surah: number;
  ayah: number;
  token: number;
  measure: "A" | "B" | "C";
  relation: "direct" | "related";
  form: string;
  raw: string;
  root?: string;
}

export interface SeedPlan {
  methodology: Record<string, unknown>;
  names: Array<{ row: Record<string, unknown>; counts: NameCounts; occurrences: OccurrenceRow[]; queryHash: string }>;
  topics: Array<{ row: Record<string, unknown>; links: Array<{ nameSlug: string; surah: number | null; ayah: number | null; basis: string; evidence_status: "sourced" | "needs_source" }> }>;
}

export function occurrenceRows(c: NameCounts): OccurrenceRow[] {
  return [...c.A.occurrences, ...c.B.occurrences, ...c.C.occurrences].map((o) => ({
    surah: o.surah, ayah: o.ayah, token: o.tokenIndex, measure: o.measure, relation: o.relation, form: o.matchedForm, raw: o.raw, ...(o.root ? { root: o.root } : {}),
  }));
}

export function buildSeed(corpus: Corpus, names: NameDraft[], topics: TopicDraft[], index: CorpusIndex = buildIndex(corpus)): SeedPlan {
  const problems = [...validateRegistry(names), ...findHardcodedCounts({ names, topics }).map((p) => `hard-coded count at ${p}`)];
  if (problems.length) throw new Error(`registry refused: ${problems.join("; ")}`);
  const bySlug = new Map(names.map((n) => [n.slug, n]));
  const planNames = names.map((n) => {
    assertAsmaText({ en: n.en, mar: n.mar, ur: n.ur });
    const counts = countName(index, buildQuery(n));
    return {
      row: {
        slug: n.slug, name_ar: n.ar, name_ar_vowelled: n.v, transliteration: n.tr, rendering_en: n.en, rendering_ar: n.mar, rendering_ur: n.ur, root: n.root,
        surface_forms: surfaceFormsOf(n), recognition_status: n.recognition ?? "educational_list",
        ai_generated: true, ai_model: SEED_AI_MODEL, prompt_version: SEED_PROMPT_VERSION,
      },
      counts,
      occurrences: occurrenceRows(counts),
      queryHash: queryHash(buildQuery(n)),
    };
  });
  const firstVerse = new Map(planNames.map((p) => [p.row.slug as string, p.counts.A.occurrences[0] ?? null]));
  const planTopics = topics.map((t) => {
    assertAsmaText({ en: t.en, ar: t.ar, ur: t.ur });
    for (const s of t.names) if (!bySlug.has(s)) throw new Error(`topic ${t.slug} names an unknown Name: ${s}`);
    return {
      row: { slug: t.slug, position: t.position, title_en: t.en, title_ar: t.ar, title_ur: t.ur, ai_generated: true, ai_model: SEED_AI_MODEL, prompt_version: SEED_PROMPT_VERSION },
      links: t.names.map((s) => {
        const v = firstVerse.get(s) ?? null;
        return v
          ? { nameSlug: s, surah: v.surah, ayah: v.ayah, basis: "This verse contains the Name's exact surface form (computed from the Quran text). The thematic link awaits a scholarly reviewer.", evidence_status: "sourced" as const }
          : { nameSlug: s, surah: null, ayah: null, basis: "No exact surface form of this Name was found to cite; the link awaits a scholarly reviewer.", evidence_status: "needs_source" as const };
      }),
    };
  });
  const e = corpus.edition;
  return {
    methodology: {
      version: METHODOLOGY_VERSION,
      normalisation_policy: ENGINE_VERSIONS.normalisation,
      tokenisation_policy: ENGINE_VERSIONS.tokenisation,
      query_version: QUERY_VERSION,
      edition_source: e.source,
      edition_version: e.version,
      edition_sha256: e.sha256,
      edition_content_sha256: e.contentSha256,
      description: "Exact surface forms (A), reviewed variants (B, none yet) and related-root forms (C, none yet), computed word by word from the pinned Tanzil Uthmani text; the leading basmala of surah-opening ayat is not counted.",
      is_current: true,
    },
    names: planNames,
    topics: planTopics,
  };
}
