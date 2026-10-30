/**
 * The eight validation checks on a QITL Explanatory Summary and who may sign each one. Mirrors the database's
 * public.can_sign_check (migration 20261031001200); the database is the lock, this drives the UI. An admin holds
 * every role there (public.has_role), so the same is true here.
 */
import type { CheckKey } from "./types";

export type ReviewRole = "editor" | "scholarly_reviewer" | "translation_reviewer" | "admin" | "moderator";

export const CHECKS: Array<{ key: CheckKey; label: string; help: string; roles: ReviewRole[] }> = [
  { key: "arabic_source", label: "Arabic source", help: "The Arabic quoted is the pinned source text, verbatim.", roles: ["editor", "scholarly_reviewer"] },
  { key: "references", label: "References", help: "Every reference resolves to the cited ayah, edition or work.", roles: ["editor", "scholarly_reviewer"] },
  { key: "licensing", label: "Licensing", help: "Every quoted edition is verified and its licence is cleared.", roles: ["editor", "scholarly_reviewer"] },
  { key: "attribution", label: "Attribution", help: "Each quotation names its translator or scholar, edition, year and licence.", roles: ["editor", "scholarly_reviewer"] },
  { key: "grammar", label: "Grammar", help: "Grammatical and morphological statements are correct.", roles: ["editor", "scholarly_reviewer"] },
  { key: "hadith_grading", label: "Hadith grading", help: "Any narration cited carries its grading by a named scholar; none is presented as sahih without one.", roles: ["scholarly_reviewer"] },
  { key: "sunni_scholarly", label: "Sunni scholarly review", help: "The explanation is within recognised Sunni scholarship and presents real disagreements fairly.", roles: ["scholarly_reviewer"] },
  { key: "language_quality", label: "Language quality", help: "Clear, accurate and natural in the target language.", roles: ["translation_reviewer", "scholarly_reviewer"] },
];

export function canSign(key: CheckKey, roles: readonly string[]): boolean {
  if (roles.includes("admin")) return true;
  const c = CHECKS.find((x) => x.key === key);
  return Boolean(c && c.roles.some((r) => roles.includes(r)));
}

export interface ReviewRecord {
  check_key: CheckKey;
  passed: boolean;
  explanation_version: number;
  reviewer_id: string;
  note: string | null;
  created_at: string;
}

/** The latest record per check decides; a pass on an older version no longer counts. */
export function checkStatus(records: ReviewRecord[], version: number) {
  return CHECKS.map((c) => {
    const latest = records.filter((r) => r.check_key === c.key).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
    const state: "passed" | "failed" | "stale" | "unsigned" = !latest ? "unsigned" : latest.explanation_version !== version ? "stale" : latest.passed ? "passed" : "failed";
    return { ...c, latest, state };
  });
}

export const allChecksPassed = (records: ReviewRecord[], version: number) => checkStatus(records, version).every((c) => c.state === "passed");
