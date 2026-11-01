import type { EvidenceKind } from "@/content/labels";

/**
 * The six evidence classes of the Lineage of Humanity (docs/LINEAGE.md). A class says WHERE a link comes from, never
 * how worthy a person is. It is DERIVED from a claim and its references; editors cannot colour a link by hand.
 * `deriveEvidenceClass` mirrors the database function public.lineage_evidence_class (a DB test compares them).
 *
 * Colour is never the only signal: each class also has its own line pattern and a text label. The colour tokens are
 * defined as CSS variables in src/styles/lineage.css (with dark mode); `CLASS_TOKENS` repeats the values so a unit test
 * can check that the CSS matches and that every text/background pair has a contrast of at least 4.5:1.
 */
export const LINEAGE_CLASSES = ["quran", "hadith", "scholar", "scripture", "history", "unknown"] as const;
export type LineageClass = (typeof LINEAGE_CLASSES)[number];

export const isLineageClass = (v: unknown): v is LineageClass => typeof v === "string" && (LINEAGE_CLASSES as readonly string[]).includes(v);

/** Line patterns, all distinguishable without colour. `family` is the coarse solid / dashed / dotted reading. */
export type LinePattern = "solid" | "longDash" | "dash" | "dot" | "dashDot" | "sparseDot";
export const LINE_PATTERNS: Record<LinePattern, { family: "solid" | "dashed" | "dotted"; dasharray: string }> = {
  solid: { family: "solid", dasharray: "none" },
  longDash: { family: "dashed", dasharray: "16 6" },
  dash: { family: "dashed", dasharray: "8 6" },
  dot: { family: "dotted", dasharray: "3 5" },
  dashDot: { family: "dashed", dasharray: "12 5 3 5" },
  sparseDot: { family: "dotted", dasharray: "3 11" },
};

export const CLASS_PATTERN: Record<LineageClass, LinePattern> = {
  quran: "solid",
  hadith: "longDash",
  scholar: "dash",
  scripture: "dot",
  history: "dashDot",
  unknown: "sparseDot",
};

export function lineStyleFor(c: LineageClass): { pattern: LinePattern; family: "solid" | "dashed" | "dotted"; dasharray: string } {
  const pattern = CLASS_PATTERN[c];
  return { pattern, ...LINE_PATTERNS[pattern] };
}

/** Class colours. `bg` fills a chip and strokes a line; `fg` is the text on that fill. Light and dark themes. */
export const CLASS_TOKENS: Record<LineageClass, { light: { bg: string; fg: string }; dark: { bg: string; fg: string } }> = {
  quran: { light: { bg: "#17613F", fg: "#FFFFFF" }, dark: { bg: "#6CCB9A", fg: "#07120E" } },
  hadith: { light: { bg: "#337B58", fg: "#FFFFFF" }, dark: { bg: "#7FD1A8", fg: "#07120E" } },
  // The brief's amber is #947140: its contrast with white text is 4.47:1, so it is darkened to #916F3F (4.62:1).
  scholar: { light: { bg: "#916F3F", fg: "#FFFFFF" }, dark: { bg: "#D9B56F", fg: "#07120E" } },
  scripture: { light: { bg: "#3D729D", fg: "#FFFFFF" }, dark: { bg: "#8DBBE4", fg: "#07120E" } },
  history: { light: { bg: "#7463A5", fg: "#FFFFFF" }, dark: { bg: "#B3A6E3", fg: "#07120E" } },
  unknown: { light: { bg: "#666C75", fg: "#FFFFFF" }, dark: { bg: "#AEB4BD", fg: "#07120E" } },
};

/** WCAG 2.x relative luminance and contrast ratio of two #rrggbb colours. */
export function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Reference kinds as stored in claim_references.kind. */
export type ReferenceKind = "quran" | "hadith" | "tafsir" | "history" | "scholar" | "scripture";

/** Which classes the references of a claim point at (mirror of public.lineage_ref_classes). */
export function referenceClasses(kinds: readonly string[]): LineageClass[] {
  const map: Record<string, LineageClass> = { quran: "quran", hadith: "hadith", tafsir: "scholar", scholar: "scholar", scripture: "scripture", history: "history" };
  const out = new Set<LineageClass>();
  for (const k of kinds) if (map[k]) out.add(map[k]!);
  return LINEAGE_CLASSES.filter((c) => out.has(c)).sort();
}

/**
 * Derive the class of a link from the claim behind it (mirror of public.lineage_evidence_class).
 *  - disputed or unknown (on the link or on the claim): grey, whatever else is cited;
 *  - Quran / hadith: only when the claim cites a verse / a narration, otherwise the label is not backed: grey;
 *  - scholar: tafsir / scholar references; if only earlier-scripture witnesses are cited it is "ancient biblical
 *    manuscripts"; if only historical sources, "historical / archaeological research";
 *  - estimate: historical research first, then earlier-scripture witnesses, then scholarship.
 */
export function deriveEvidenceClass(input: { confidence: EvidenceKind; claimEvidence: EvidenceKind | null; referenceKinds: readonly string[] }): LineageClass {
  const { confidence, claimEvidence } = input;
  if (claimEvidence === null) return "unknown";
  if (confidence === "disputed" || confidence === "unknown" || claimEvidence === "disputed" || claimEvidence === "unknown") return "unknown";
  const refs = new Set(referenceClasses(input.referenceKinds));
  if (claimEvidence === "quran") return refs.has("quran") ? "quran" : "unknown";
  if (claimEvidence === "hadith") return refs.has("hadith") ? "hadith" : "unknown";
  if (claimEvidence === "scholar") return refs.has("scholar") ? "scholar" : refs.has("scripture") ? "scripture" : refs.has("history") ? "history" : "unknown";
  if (claimEvidence === "estimate") return refs.has("history") ? "history" : refs.has("scripture") ? "scripture" : refs.has("scholar") ? "scholar" : "unknown";
  return "unknown";
}
