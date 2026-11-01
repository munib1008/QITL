import type { LineageClaim, LineageCounts, LineageDoc, LineageGap, LineageLink, ScriptureWitness } from "./types";
import type { EvidenceKind } from "@/content/labels";
import type { LineageClass } from "./classes";

/**
 * Synthetic data for the automated tests and the empty-state checks. The people are "Test person N": they are not real
 * people, the claims are not real claims, and the pages that show them carry a banner saying so.
 */
export const FIXTURE_START = "fixture-first";
export const FIXTURE_END = "fixture-last";

const PEOPLE: Array<[string, string]> = [
  [FIXTURE_START, "Test person 1"],
  ["fixture-a", "Test person 2"],
  ["fixture-b", "Test person 3"],
  ["fixture-c", "Test person 4"],
  ["fixture-d", "Test person 5"],
  ["fixture-e", "Test person 6"],
  ["fixture-alt", "Test person 7 (alternative)"],
  [FIXTURE_END, "Test person 8"],
];

const claim = (id: string, statement: string, evidence: EvidenceKind, kind: string, witness = false): LineageClaim => ({
  id,
  statement,
  evidence,
  references: [
    {
      kind,
      surah: null,
      from: null,
      to: null,
      locator: "Test fixture 1:1",
      source: null,
      witness: witness ? { slug: "fixture-witness-b", name: "Test witness B", layer: "zabur" } : null,
    },
  ],
});

const refKind: Record<LineageClass, string> = { quran: "quran", hadith: "hadith", scholar: "scholar", scripture: "scripture", history: "history", unknown: "scholar" };

const link = (id: string, ancestor: string, descendant: string, cls: LineageClass, o: Partial<LineageLink> = {}): LineageLink => ({
  id,
  kind: "parent_of",
  ancestor,
  descendant,
  confidence: cls === "unknown" ? "disputed" : "scholar",
  evidenceClass: cls,
  referenceClasses: [cls],
  competingGroup: null,
  tradition: null,
  uncertainty: `Synthetic test link ${id}: what is uncertain is stated in one sentence.`,
  claim: claim(`c-${id}`, `Synthetic test claim for link ${id}.`, cls === "unknown" ? "disputed" : "scholar", refKind[cls], cls === "scripture"),
  ...o,
});

const gap = (id: string, ancestor: string, descendant: string, cls: LineageClass): LineageGap => ({
  id,
  ancestor,
  descendant,
  note: "Synthetic test gap: traditional accounts differ; the exact chain is not authenticated.",
  confidence: "disputed",
  evidenceClass: cls,
  referenceClasses: [cls],
  competingGroup: null,
  tradition: null,
  claim: claim(`c-${id}`, `Synthetic test claim for gap ${id}.`, "disputed", "scholar"),
});

export function fixtureLineage(): LineageDoc {
  return {
    people: PEOPLE.map(([id, name]) => ({ id, name, nameAr: null, kind: "other" })),
    links: [
      link("f1", FIXTURE_START, "fixture-a", "quran"),
      link("f2", "fixture-a", "fixture-b", "hadith", { competingGroup: "g1", confidence: "hadith" }),
      link("f2b", "fixture-a", "fixture-b", "scholar", { competingGroup: "g1", tradition: "Fixture tradition B" }),
      link("f3", "fixture-c", "fixture-d", "scripture"),
      link("f4", "fixture-d", "fixture-e", "history"),
      link("f5", "fixture-e", FIXTURE_END, "scholar"),
      link("f6", "fixture-a", "fixture-alt", "scholar", { tradition: "Fixture tradition B" }),
      link("f7", "fixture-alt", "fixture-b", "unknown", { tradition: "Fixture tradition B" }),
    ],
    gaps: [gap("g1", "fixture-b", "fixture-c", "unknown")],
    nodeClaims: [
      {
        id: "n1",
        person: "fixture-a",
        aspect: "name",
        note: "Synthetic test note.",
        confidence: "scholar",
        evidenceClass: "scholar",
        claim: claim("c-n1", "Synthetic test claim about a name.", "scholar", "scholar"),
      },
    ],
  };
}

export const FIXTURE_COUNTS: LineageCounts = {
  links: { published: 8, underReview: 3 },
  gaps: { published: 1, underReview: 1 },
  nodeClaims: { published: 1, underReview: 0 },
  witnesses: { published: 3, underReview: 7 },
};

export const FIXTURE_EMPTY_COUNTS: LineageCounts = {
  links: { published: 0, underReview: 4 },
  gaps: { published: 0, underReview: 2 },
  nodeClaims: { published: 0, underReview: 1 },
  witnesses: { published: 0, underReview: 10 },
};

export function fixtureWitnesses(): ScriptureWitness[] {
  const w = (slug: string, layer: ScriptureWitness["layer"], kind: ScriptureWitness["kind"], name: string, dating: string | null): ScriptureWitness => ({
    id: slug,
    slug,
    layer,
    kind,
    name,
    nameAr: null,
    nameUr: null,
    language: "Test language",
    dating,
    whatItIs: "Synthetic test entry: it describes no real manuscript.",
    limitation: "Synthetic test limitation: no surviving witness can be certified as an original revelation.",
  });
  return [
    w("fixture-witness-a", "tawrah", "manuscript_tradition", "Test witness A", "Test broad range"),
    w("fixture-witness-b", "zabur", "codex", "Test witness B", null),
    w("fixture-witness-c", "injil", "papyri", "Test witness C", "Test broad range"),
  ];
}
