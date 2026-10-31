import type { EvidenceKind } from "@/content/labels";

/** The shape returned by the person_graph RPC. */
export interface GenealogyGraph {
  focus: string;
  nodes: Array<{ id: string; name: string; nameAr: string; kind: string; distance: number }>;
  edges: Array<{
    id: string;
    from: string;
    to: string;
    kind: string;
    confidence: EvidenceKind;
    competingGroup: string | null;
    claim: { id: string; statement: string; evidence: EvidenceKind; references: Array<{ kind: string; surah: number | null; from: number | null; to: number | null; locator: string | null }> };
  }>;
}

export const REL = { parent_of: "parent of", spouse_of: "spouse of", sibling_of: "sibling of", descendant_of: "descendant of" } as const;
export type LineStatus = "verified" | "disputed" | "unknown";
export const lineStatus = (c: EvidenceKind): LineStatus => (c === "disputed" ? "disputed" : c === "unknown" ? "unknown" : "verified");
export const LINE_TEXT: Record<LineStatus, string> = { verified: "Established (sourced) line", disputed: "Disputed line", unknown: "Unknown link" };
