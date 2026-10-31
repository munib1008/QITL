import { z } from "zod";
import { CitationInput } from "@/lib/mufti";
import { ayahHash } from "@/lib/refs";

/**
 * Dream Understanding Centre: request schemas and the reference lists shown on /dreams.
 * The submission form collects the dream, an optional question and the answer language only: never age, gender,
 * marital status, health or any other profile field (the schema is strict, so extra fields are refused).
 */

/** Bump when the consent wording in src/lib/i18n/modules/dreams.ts changes; stored with every consent row. */
export const DREAM_NOTICE_VERSION = "v1";
export const RETENTION_DAYS = [30, 90, 180, 365] as const;
export const DREAM_LANGUAGES = ["en", "ar", "ur"] as const;
export const DREAM_OUTCOMES = ["interpretation", "meaning_unknown", "insufficient_basis", "not_for_interpretation"] as const;
export const DREAM_REASONS = ["outside_scope", "insufficient_detail", "capacity", "duplicate", "completed", "other"] as const;

export const DreamSubmit = z
  .object({
    dream: z.string().trim().min(20).max(6000),
    question: z.string().trim().max(1000).optional(),
    language: z.enum(DREAM_LANGUAGES),
    consent: z.literal(true),
  })
  .strict();

export const DreamPrefsInput = z
  .object({ retentionDays: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)]) })
  .strict();

export const DreamPatch = z
  .object({
    status: z.enum(["withdrawn", "closed"]).optional(),
    retainUntil: z.string().datetime({ offset: true }).optional(),
    scholarAccess: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.status !== undefined || v.retainUntil !== undefined || v.scholarAccess !== undefined, "nothing to change");

export const DreamDelete = z.object({ confirm: z.literal("DELETE") }).strict();

export const SecondOpinionInput = z.object({ firstResponseId: z.string().uuid(), consent: z.literal(true) }).strict();

export const DreamResponseCreate = z
  .object({
    requestId: z.string().uuid(),
    outcome: z.enum(DREAM_OUTCOMES),
    body: z.string().trim().min(20).max(8000),
    secondOpinionId: z.string().uuid().optional(),
    submit: z.boolean().default(false),
  })
  .strict();

export const DreamResponsePatch = z
  .object({
    outcome: z.enum(DREAM_OUTCOMES).optional(),
    body: z.string().trim().min(20).max(8000).optional(),
    status: z.enum(["draft", "submitted", "released", "withdrawn"]).optional(),
    acknowledged: z.literal(true).optional(),
  })
  .strict()
  .refine((v) => v.status !== "released" || v.acknowledged === true, { message: "acknowledge the notice before releasing", path: ["acknowledged"] });

export const DreamReferenceInput = CitationInput;

export const DreamReviewInput = z
  .object({
    responseId: z.string().uuid(),
    version: z.number().int().min(1),
    decision: z.enum(["approved", "changes_requested", "rejected"]),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

export const DreamAdminAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), requestId: z.string().uuid(), scholarId: z.string().uuid(), role: z.enum(["primary", "reviewer", "second_opinion"]) }).strict(),
  z.object({ action: z.literal("unassign"), requestId: z.string().uuid(), scholarId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("status"), requestId: z.string().uuid(), status: z.enum(["declined", "closed"]), reason: z.enum(DREAM_REASONS) }).strict(),
]);

/** Quranic passages that mention dreams (docs/proposals/2026-10-31-briefs-review.md section 3). References only. */
export const QURAN_DREAM_REFERENCES = [
  { surah: 12, from: 4, to: 6 },
  { surah: 12, from: 36, to: 42 },
  { surah: 12, from: 43, to: 49 },
  { surah: 12, from: 100, to: 100 },
  { surah: 37, from: 102, to: 107 },
  { surah: 48, from: 27, to: 27 },
] as const;

export const SURAH_NAMES: Record<number, { en: string; ar: string }> = {
  12: { en: "Yusuf", ar: "يوسف" },
  37: { en: "As-Saffat", ar: "الصافات" },
  48: { en: "Al-Fath", ar: "الفتح" },
};

/**
 * Hadith references shown on /dreams. No text: every one renders with the "licence pending" state until a licensed
 * edition is imported and its numbering checked.
 */
export const HADITH_DREAM_REFERENCES = [
  { key: "kinds", collection: "muslim", collectionName: "Sahih Muslim", number: "2263", href: "/hadith/muslim/2263" },
  { key: "goodBad", collection: "bukhari", collectionName: "Sahih al-Bukhari", number: null, book: "Book of Dream Interpretation (Kitab al-Ta'bir)", href: "/hadith/bukhari" },
] as const;

export function quranRefLabel(r: { surah: number; from: number; to: number }): string {
  return r.from === r.to ? `Q ${r.surah}:${r.from}` : `Q ${r.surah}:${r.from}–${r.to}`;
}
/** Opens the reader on the passage; a range lights every ayah in it, like every other Quran link (src/lib/refs.ts). */
export function quranRefHref(r: { surah: number; from: number; to?: number }): string {
  return `/quran/${r.surah}${ayahHash(r.from, r.to)}`;
}
