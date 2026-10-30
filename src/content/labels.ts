/**
 * Display labels for certainty, kept free of the journey data and of zod so client components can import them
 * without pulling the content into the browser bundle.
 */
export type EvidenceKind = "quran" | "hadith" | "scholar" | "estimate" | "disputed" | "unknown";
export type EraCertainty = "relative" | "estimate" | "traditional" | "exact" | "unknown" | "disputed";
export type PlaceCertainty = "point" | "region" | "hypothesis" | "disputed" | "unknown";

export const ERA_TEXT: Record<EraCertainty, string> = {
  relative: "Chronological position",
  estimate: "Historians' estimate",
  traditional: "Traditional estimate",
  exact: "Established date",
  unknown: "Date unknown",
  disputed: "Date disputed",
};

export const PLACE_TEXT: Record<PlaceCertainty, string> = {
  point: "Verified place",
  region: "Approximate region",
  hypothesis: "Historical hypothesis",
  disputed: "Disputed location",
  unknown: "Location unknown",
};
