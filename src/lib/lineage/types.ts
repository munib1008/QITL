import type { EvidenceKind } from "@/content/labels";
import type { LineageClass } from "./classes";

/** The shape returned by the public.lineage_graph() RPC: published rows only. */
export interface LineageReference {
  kind: string;
  surah: number | null;
  from: number | null;
  to: number | null;
  locator: string | null;
  source: string | null;
  witness: { slug: string; name: string; layer: "tawrah" | "zabur" | "injil" } | null;
}

export interface LineageClaim {
  id: string;
  statement: string;
  evidence: EvidenceKind;
  references: LineageReference[];
}

export interface LineagePerson {
  id: string; // slug
  name: string;
  nameAr: string | null;
  kind: string;
}

export interface LineageLink {
  id: string;
  kind: "parent_of" | "descendant_of";
  ancestor: string;
  descendant: string;
  confidence: EvidenceKind;
  evidenceClass: LineageClass;
  referenceClasses: LineageClass[];
  competingGroup: string | null;
  tradition: string | null;
  uncertainty: string | null;
  claim: LineageClaim;
}

export interface LineageGap {
  id: string;
  ancestor: string;
  descendant: string;
  note: string;
  confidence: EvidenceKind;
  evidenceClass: LineageClass;
  referenceClasses: LineageClass[];
  competingGroup: string | null;
  tradition: string | null;
  claim: LineageClaim;
}

export interface LineageNodeClaim {
  id: string;
  person: string;
  aspect: "identity" | "name" | "lifespan" | "dates";
  note: string | null;
  confidence: EvidenceKind;
  evidenceClass: LineageClass;
  claim: LineageClaim;
}

export interface LineageDoc {
  people: LineagePerson[];
  links: LineageLink[];
  gaps: LineageGap[];
  nodeClaims: LineageNodeClaim[];
}

export interface LineageCounts {
  links: { published: number; underReview: number };
  gaps: { published: number; underReview: number };
  nodeClaims: { published: number; underReview: number };
  witnesses: { published: number; underReview: number };
}

/** A published scripture witness (public.scripture_witnesses). Dating NULL means "Not established". */
export interface ScriptureWitness {
  id: string;
  slug: string;
  layer: "tawrah" | "zabur" | "injil";
  kind: "manuscript_tradition" | "manuscript_collection" | "translation_tradition" | "codex" | "papyri";
  name: string;
  nameAr: string | null;
  nameUr: string | null;
  language: string;
  dating: string | null;
  whatItIs: string;
  limitation: string;
}

export const EMPTY_DOC: LineageDoc = { people: [], links: [], gaps: [], nodeClaims: [] };
export const EMPTY_COUNTS: LineageCounts = {
  links: { published: 0, underReview: 0 },
  gaps: { published: 0, underReview: 0 },
  nodeClaims: { published: 0, underReview: 0 },
  witnesses: { published: 0, underReview: 0 },
};

/** One step of a route: two people and every published way the sources connect them (competing options side by side). */
export interface RouteOption {
  type: "link" | "gap";
  id: string;
  evidenceClass: LineageClass;
  tradition: string | null;
  competingGroup: string | null;
}
export interface RouteStep {
  ancestor: string;
  descendant: string;
  options: RouteOption[];
}
export interface Route {
  steps: RouteStep[];
  /** Distinct named traditions across the steps' options chosen for this route; more than one means incompatible. */
  traditions: string[];
}

export type PathStatus = "connected" | "incompatible" | "not_connected" | "missing_endpoint";
export interface LineagePath {
  status: PathStatus;
  start: string;
  end: string;
  /** Routes whose links are mutually compatible (one tradition at most). */
  routes: Route[];
  /** Routes that exist only by mixing traditions: never shown as a chain. */
  incompatible: Route[];
  /** Published people reachable downward from the start / upward from the end (what is established so far). */
  fromStart: string[];
  toEnd: string[];
}
