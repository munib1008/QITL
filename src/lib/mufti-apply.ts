import { z } from "zod";
import { MADHHABS } from "@/lib/mufti";

/** Scholar application request schemas. The database enforces the same rules again (migration 20261031002610). */

/** The version of the consent text shown on the form (src/lib/i18n/modules/muftiApply.ts, form.consent); stored with the application. */
export const APPLICATION_CONSENT_VERSION = "v1";

export const ApplyInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    credentials: z.string().trim().min(20).max(5000),
    madhhab: z.enum(MADHHABS).nullable().optional(),
    field: z.string().trim().min(2).max(120).nullable().optional(),
    links: z.array(z.string().trim().regex(/^https:\/\/[^\s<>"]{4,250}$/, "an https address")).max(5).default([]),
    consent: z.literal(true),
  })
  .strict();

export const DecideApplicationInput = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["under_review", "verified", "declined"]),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((v) => v.status === "under_review" || (v.note !== undefined && v.note.length >= 4), { message: "say why", path: ["note"] });

export const MarkReadInput = z
  .object({ ids: z.array(z.string().uuid()).min(1).max(100).optional(), all: z.literal(true).optional() })
  .strict()
  .refine((v) => Boolean(v.ids) !== Boolean(v.all), "ids or all");
