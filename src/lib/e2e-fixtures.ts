import "server-only";
import { publicEnv } from "@/lib/env";
import type { GenealogyGraph } from "@/components/genealogy/types";

/**
 * Synthetic data for the automated browser tests, so views that need the database (the genealogy explorer) can be
 * exercised without one. Active only when QITL_E2E_FIXTURES=1 AND Supabase is not configured; the page then shows a
 * banner saying the people and links are synthetic. These are not real people and not real relationships.
 */
export function e2eFixturesEnabled(): boolean {
  return process.env.QITL_E2E_FIXTURES === "1" && !(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

const PEOPLE: Array<[string, string]> = [
  ["fixture-elder", "Test elder"],
  ["fixture-parent", "Test parent"],
  ["fixture-spouse", "Test spouse"],
  ["fixture-sibling", "Test sibling"],
  ["fixture-child-a", "Test child A"],
  ["fixture-child-b", "Test child B"],
  ["fixture-grandchild", "Test grandchild"],
  ["fixture-other-elder", "Test other elder"],
];

const claim = (id: string, statement: string, evidence: "scholar" | "disputed" | "unknown") => ({ id, statement, evidence, references: [{ kind: "scholar", surah: null, from: null, to: null, locator: "Test fixture" }] });

export function fixtureGraph(focus: string): GenealogyGraph {
  const center = PEOPLE.some(([id]) => id === focus) ? focus : "fixture-parent";
  return {
    focus: center,
    nodes: PEOPLE.map(([id, name]) => ({ id, name, nameAr: name, kind: "person", distance: id === center ? 0 : 1 })),
    edges: [
      { id: "e1", from: "fixture-elder", to: "fixture-parent", kind: "parent_of", confidence: "scholar", competingGroup: "g1", claim: claim("c1", "Synthetic test link: established line.", "scholar") },
      { id: "e2", from: "fixture-other-elder", to: "fixture-parent", kind: "parent_of", confidence: "disputed", competingGroup: "g1", claim: claim("c2", "Synthetic test link: a competing, disputed line.", "disputed") },
      { id: "e3", from: "fixture-parent", to: "fixture-spouse", kind: "spouse_of", confidence: "scholar", competingGroup: null, claim: claim("c3", "Synthetic test link: spouse.", "scholar") },
      { id: "e4", from: "fixture-parent", to: "fixture-sibling", kind: "sibling_of", confidence: "unknown", competingGroup: null, claim: claim("c4", "Synthetic test link: unknown sibling link.", "unknown") },
      { id: "e5", from: "fixture-parent", to: "fixture-child-a", kind: "parent_of", confidence: "scholar", competingGroup: null, claim: claim("c5", "Synthetic test link: child A.", "scholar") },
      { id: "e6", from: "fixture-parent", to: "fixture-child-b", kind: "parent_of", confidence: "scholar", competingGroup: null, claim: claim("c6", "Synthetic test link: child B.", "scholar") },
      { id: "e7", from: "fixture-child-a", to: "fixture-grandchild", kind: "parent_of", confidence: "disputed", competingGroup: null, claim: claim("c7", "Synthetic test link: disputed grandchild.", "disputed") },
    ],
  };
}
