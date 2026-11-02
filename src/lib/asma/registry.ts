import { QUERY_VERSION, type AcceptedVariant, type NameQuery, type RelatedRootGroup } from "./count";
import { normalizeArabic } from "./normalize";

/**
 * The registry draft: the commonly taught list of names as DRAFT educational-collection entries. Nothing here says
 * which transmitted enumeration is authentic; nothing says the Names are limited to a number. No count lives here.
 */
export const RECOGNITION_STATUSES = ["educational_list", "disputed_candidate", "under_research"] as const;
export type RecognitionStatus = (typeof RECOGNITION_STATUSES)[number];

export const RECOGNITION_NOTE_EN = "Educational list - enumeration not established by this platform";

export interface NameDraft {
  slug: string;
  /** standard spelling with the definite article (or the construct form) */
  ar: string;
  /** vowelled spelling */
  v: string;
  tr: string;
  /** extra exact surface spellings in the Quran file's own orthography (normalised); optional */
  forms?: string[];
  root: string | null;
  en: string;
  mar: string;
  ur: string;
  recognition?: RecognitionStatus;
  /** reviewed inclusion list (B); default none */
  acceptedVariants?: AcceptedVariant[];
  /** reviewed related-root forms (C); default none */
  relatedRoots?: RelatedRootGroup[];
}

export const SLUG_RE = /^[a-z][a-z0-9-]{1,60}$/;

/** Surface forms registered for measure A: the standard spelling plus the explicit orthographic extras. */
export function surfaceFormsOf(n: Pick<NameDraft, "ar" | "forms">): string[] {
  return [...new Set([normalizeArabic(n.ar), ...(n.forms ?? []).map((f) => normalizeArabic(f))])];
}

export function buildQuery(n: NameDraft): NameQuery {
  return { slug: n.slug, surfaceForms: surfaceFormsOf(n), acceptedVariants: n.acceptedVariants ?? [], relatedRoots: n.relatedRoots ?? [] };
}

/** Registry problems (structure only, never religious content): returns a list of messages, empty when sound. */
export function validateRegistry(names: NameDraft[]): string[] {
  const problems: string[] = [];
  const slugs = new Set<string>();
  const forms = new Map<string, string>();
  for (const n of names) {
    if (!SLUG_RE.test(n.slug)) problems.push(`${n.slug}: bad slug`);
    if (slugs.has(n.slug)) problems.push(`${n.slug}: duplicate slug`);
    slugs.add(n.slug);
    for (const f of surfaceFormsOf(n)) {
      const owner = forms.get(f);
      if (owner && owner !== n.slug) problems.push(`${n.slug}: surface form ${f} is also registered for ${owner}`);
      forms.set(f, n.slug);
    }
    if (normalizeArabic(n.v) !== normalizeArabic(n.ar)) problems.push(`${n.slug}: vowelled form differs from the plain spelling`);
    for (const k of ["en", "mar", "ur", "tr"] as const) if (!n[k] || n[k].trim().length < 2) problems.push(`${n.slug}: missing ${k}`);
    if (n.root !== null && !/^[ء-ي](-[ء-ي]){2,3}$/.test(n.root)) problems.push(`${n.slug}: root must be 3-4 Arabic letters joined by hyphens, or null`);
    if (n.recognition && !RECOGNITION_STATUSES.includes(n.recognition)) problems.push(`${n.slug}: bad recognition status`);
    for (const v of n.acceptedVariants ?? []) if (!v.reviewRef || !v.basis) problems.push(`${n.slug}: an accepted variant needs a basis and a review reference`);
  }
  return problems;
}

export { QUERY_VERSION };
