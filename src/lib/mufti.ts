import { z } from "zod";
import { ayahHash } from "@/lib/refs";

/** Mufti Q&A request schemas and pure helpers. Every API route validates with these; the database enforces the rules again. */

export const QUESTION_TOPICS = ["general", "quran_verse", "hadith", "person", "event", "creation"] as const;
export const MADHHABS = ["hanafi", "maliki", "shafii", "hanbali", "other"] as const;

const Ref = z
  .string()
  .trim()
  .max(80)
  .regex(/^(Q \d{1,3}:\d{1,3}([–-]\d{1,3})?|[A-Za-z' -]{2,40} \d{1,6}[a-z]?|[a-z0-9-]{2,60})$/, "a Quran (Q 2:255), hadith (Bukhari 1) or page reference");

export const AskInput = z
  .object({
    title: z.string().trim().min(8).max(200),
    body: z.string().trim().min(20).max(5000),
    visibility: z.enum(["public", "private"]),
    topicType: z.enum(QUESTION_TOPICS).optional(),
    topicRef: Ref.optional(),
  })
  .strict();

export const QuestionFollowInput = z.object({ questionId: z.string().uuid(), follow: z.boolean() }).strict();

export const ProfileInput = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    madhhab: z.enum(MADHHABS).nullable(),
    credentials: z.string().trim().min(20).max(5000),
  })
  .strict();

export const AnswerCreate = z
  .object({ questionId: z.string().uuid(), body: z.string().trim().min(20).max(20000), submit: z.boolean().default(false) })
  .strict();

export const AnswerPatch = z
  .object({
    body: z.string().trim().min(20).max(20000).optional(),
    status: z.enum(["draft", "submitted", "published", "withdrawn"]).optional(),
  })
  .strict()
  .refine((v) => v.body !== undefined || v.status !== undefined, "nothing to change");

export const CitationInput = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("quran"),
      surah: z.coerce.number().int().min(1).max(114),
      ayahFrom: z.coerce.number().int().min(1).max(286),
      ayahTo: z.coerce.number().int().min(1).max(286).optional(),
      note: z.string().trim().max(500).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("hadith"), hadithId: z.string().uuid(), note: z.string().trim().max(500).optional() }).strict(),
  z
    .object({ kind: z.literal("scholar"), work: z.string().trim().min(2).max(300), locator: z.string().trim().max(200).optional(), note: z.string().trim().max(500).optional() })
    .strict(),
]).refine((v) => v.kind !== "quran" || v.ayahTo === undefined || v.ayahTo >= v.ayahFrom, { message: "the range must end after it starts", path: ["ayahTo"] });
export type CitationInput = z.infer<typeof CitationInput>;

/** Row values for mufti_answer_citations / dream_reference_links from a validated citation. */
export function citationRow(c: CitationInput) {
  return {
    kind: c.kind,
    quran_surah: c.kind === "quran" ? c.surah : null,
    quran_ayah_from: c.kind === "quran" ? c.ayahFrom : null,
    quran_ayah_to: c.kind === "quran" ? (c.ayahTo ?? null) : null,
    hadith_id: c.kind === "hadith" ? c.hadithId : null,
    work: c.kind === "scholar" ? c.work : null,
    locator: c.kind === "scholar" ? (c.locator ?? null) : null,
    note: c.note ?? null,
  };
}

export const ReviewInput = z
  .object({
    answerId: z.string().uuid(),
    version: z.number().int().min(1),
    decision: z.enum(["approved", "changes_requested", "rejected"]),
    note: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((v) => v.decision === "approved" || (v.note && v.note.length >= 4), { message: "say what needs to change", path: ["note"] });

export const VerifyInput = z
  .object({
    userId: z.string().uuid(),
    action: z.enum(["verify", "unverify", "grant_role", "dream_qualify", "dream_unqualify"]),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

export const ModerateQuestionInput = z
  .object({ questionId: z.string().uuid(), action: z.enum(["accept", "reject", "close"]), note: z.string().trim().max(1000).optional() })
  .strict();

export const AssignInput = z.object({ questionId: z.string().uuid(), muftiId: z.string().uuid(), assign: z.boolean().default(true) }).strict();

export interface CitationRow {
  id?: string;
  kind: "quran" | "hadith" | "scholar";
  quran_surah: number | null;
  quran_ayah_from: number | null;
  quran_ayah_to: number | null;
  hadith_id: string | null;
  work: string | null;
  locator: string | null;
  note: string | null;
}

/** Display label and link for a stored citation. Never invents text: only the reference itself. */
export function citationDisplay(c: CitationRow): { label: string; href?: string } {
  if (c.kind === "quran" && c.quran_surah && c.quran_ayah_from) {
    const to = c.quran_ayah_to && c.quran_ayah_to !== c.quran_ayah_from ? `–${c.quran_ayah_to}` : "";
    return { label: `Q ${c.quran_surah}:${c.quran_ayah_from}${to}`, href: `/quran/${c.quran_surah}${ayahHash(c.quran_ayah_from ?? 1, c.quran_ayah_to)}` };
  }
  if (c.kind === "hadith" && c.hadith_id) return { label: `#${c.hadith_id.slice(0, 8)}` };
  return { label: [c.work, c.locator].filter(Boolean).join(", ") };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
