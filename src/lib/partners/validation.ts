import { z } from "zod";
import {
  ADDABLE_ROLES,
  AUDIENCES,
  CONTACT_KINDS,
  CURRENCIES,
  GROUP_TYPES,
  LEVELS,
  PARTNER_SET_STATUSES,
  PRICING_TYPES,
  PROVIDER_TYPES,
  QUALIFICATION_KINDS,
  REPORT_REASONS,
  SERVICE_MODES,
  SERVICE_STATUSES,
  TRACKS,
  UNIT_FOR,
  UNPRICED_TYPES,
  VERIFICATION_KINDS,
  LISTING_STATUSES,
  type PricingType,
} from "./constants";

/**
 * Request schemas for every Learning Partners write. The database enforces the same rules again (CHECK constraints,
 * RLS, guard triggers); these give the reader an answer before the round trip and keep junk out of the API.
 */
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optText = (min: number, max: number) => z.string().trim().min(min).max(max).nullish().transform((v) => v ?? null);
const uuid = z.string().uuid();
const lang = z.string().regex(/^[a-z]{2,3}$/);

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");

export const ProfileInput = z
  .object({
    slug: z.string().trim().min(3).max(60).regex(SLUG_RE, "lowercase letters, digits and hyphens"),
    provider_type: z.enum(PROVIDER_TYPES),
    display_name: text(2, 120),
    country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "a two-letter country code"),
    city: optText(1, 80),
    service_area: optText(2, 200),
    languages: z.array(lang).min(1).max(12),
    short_description: optText(20, 280),
    long_description: optText(0, 4000),
    years_experience: z.number().int().min(0).max(80).nullish().transform((v) => v ?? null),
  })
  .strict();
export const ProfilePatch = ProfileInput.partial().strict();

export const ContactInput = z
  .object({
    kind: z.enum(CONTACT_KINDS),
    label: optText(1, 60),
    value: text(3, 300),
    is_public: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.kind === "website" || v.kind === "social") && !/^https:\/\/[^\s<>"]{4,250}$/.test(v.value)) ctx.addIssue({ code: "custom", path: ["value"], message: "an https address" });
    if (v.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.value)) ctx.addIssue({ code: "custom", path: ["value"], message: "an email address" });
  });

export const ServiceInput = z
  .object({
    category_id: uuid,
    title: text(3, 140),
    description: optText(0, 2000),
    level: z.enum(LEVELS).default("all_levels"),
    audience: z.enum(AUDIENCES).default("all"),
    mode: z.enum(SERVICE_MODES),
    group_type: z.enum(GROUP_TYPES),
    duration_minutes: z.number().int().min(5).max(600).nullish().transform((v) => v ?? null),
    language: lang,
    status: z.enum(SERVICE_STATUSES).default("draft"),
  })
  .strict();

const money = z.number().positive().max(1_000_000).multipleOf(0.01);
const fee = z.number().min(0).max(1_000_000).multipleOf(0.01);

/** The pricing rules of the database (partner_pricing_* constraints), checked before the call. */
export const PricingInput = z
  .object({
    pricing_type: z.enum(PRICING_TYPES),
    currency: z.enum(CURRENCIES).nullish().transform((v) => v ?? null),
    amount: money.nullish().transform((v) => v ?? null),
    classes_included: z.number().int().min(1).max(1000).nullish().transform((v) => v ?? null),
    registration_fee: fee.nullish().transform((v) => v ?? null),
    materials_fee: fee.nullish().transform((v) => v ?? null),
    fees_note: optText(1, 300),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((UNPRICED_TYPES as readonly string[]).includes(v.pricing_type)) {
      for (const k of ["amount", "currency", "classes_included", "registration_fee", "materials_fee"] as const)
        if (v[k] !== null) ctx.addIssue({ code: "custom", path: [k], message: `${v.pricing_type} carries no ${k.replace("_", " ")}` });
    } else {
      if (v.amount === null) ctx.addIssue({ code: "custom", path: ["amount"], message: "an amount is required" });
      if (v.currency === null) ctx.addIssue({ code: "custom", path: ["currency"], message: "a currency is required" });
      if (v.pricing_type === "package" && (v.classes_included ?? 0) < 2) ctx.addIssue({ code: "custom", path: ["classes_included"], message: "a package includes two or more classes" });
    }
  });

/** The unit follows the type; callers never choose it. */
export function pricingRow(p: z.output<typeof PricingInput>) {
  const unit = p.pricing_type in UNIT_FOR ? UNIT_FOR[p.pricing_type as keyof typeof UNIT_FOR] : null;
  return { ...p, unit };
}

export const AvailabilityInput = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: text(1, 64),
    note: optText(1, 200),
  })
  .strict()
  .refine((v) => v.end_time > v.start_time, { message: "ends after it starts", path: ["end_time"] });

export const QualificationInput = z
  .object({
    kind: z.enum(QUALIFICATION_KINDS).default("certificate"),
    title: text(3, 160),
    issuer: optText(2, 160),
    year: z.number().int().min(1900).max(2100).nullish().transform((v) => v ?? null),
    claim: optText(0, 500),
    show_publicly: z.boolean().default(false),
  })
  .strict();

export const FileInput = z
  .object({
    qualification_id: uuid,
    storage_path: z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/).refine((p) => !p.includes(".."), "no path traversal"),
    mime_type: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]),
    size_bytes: z.number().int().min(1).max(10 * 1024 * 1024),
  })
  .strict();

export const MemberInput = z.object({ user_id: uuid, role: z.enum(ADDABLE_ROLES) }).strict();

export const TransitionInput = z
  .object({ to: z.enum(LISTING_STATUSES), note: z.string().trim().max(1000).optional() })
  .strict()
  .refine((v) => !["information_requested", "changes_requested", "rejected", "suspended"].includes(v.to) || (v.note ?? "").length >= 4, { message: "say why", path: ["note"] });

export const VerificationRequestInput = z.object({ kind: z.enum(VERIFICATION_KINDS) }).strict();
export const VerificationDecisionInput = z
  .object({
    kind: z.enum(VERIFICATION_KINDS),
    status: z.enum(["in_review", "verified", "rejected", "revoked"]),
    note: z.string().trim().max(1000).optional(),
    scope: z.string().trim().min(4).max(400).optional(),
  })
  .strict()
  .refine((v) => v.status === "in_review" || (v.note ?? "").length >= 4, { message: "record the decision", path: ["note"] })
  .refine((v) => v.status !== "verified" || Boolean(v.scope), { message: "state exactly what was verified", path: ["scope"] });
export const QualificationReviewInput = z
  .object({ status: z.enum(["verified", "rejected", "unverified"]), note: z.string().trim().max(1000).optional() })
  .strict()
  .refine((v) => v.status !== "rejected" || (v.note ?? "").length >= 4, { message: "say why", path: ["note"] });

export const CategoryInput = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9]+(_[a-z0-9]+)*$/).min(2).max(60),
    track: z.enum(TRACKS),
    name_en: text(2, 120),
    name_ar: text(2, 120),
    name_ur: text(2, 120),
    active: z.boolean().default(true),
    sort_order: z.number().int().min(0).max(10000).default(100),
  })
  .strict();
export const CategoryPatch = CategoryInput.partial().strict();
export const MergeInput = z.object({ from: uuid, into: uuid }).strict().refine((v) => v.from !== v.into, "two different categories");

/** Consent text version for inquiries: the learner must tick it. */
export const InquiryInput = z
  .object({
    partner_id: uuid,
    service_id: uuid.nullish().transform((v) => v ?? null),
    learner_alias: optText(1, 40),
    for_child: z.boolean().default(false),
    subject: text(3, 140),
    message: text(10, 2000),
    consent: z.literal(true),
  })
  .strict();
export const InquiryStatusInput = z.object({ status: z.enum([...PARTNER_SET_STATUSES, "closed"]) }).strict();
export const MessageInput = z.object({ body: text(1, 2000) }).strict();
export const ReportInput = z.object({ partner_id: uuid, reason: z.enum(REPORT_REASONS), details: optText(0, 2000) }).strict();
export const ReportDecisionInput = z
  .object({ status: z.enum(["reviewing", "actioned", "dismissed"]), note: z.string().trim().max(1000).optional() })
  .strict()
  .refine((v) => v.status === "reviewing" || (v.note ?? "").length >= 4, { message: "record the decision", path: ["note"] });
export const AccessLogInput = z.object({ what: z.enum(["contacts", "documents", "inquiries", "profile"]) }).strict();

export type PricingTypeInput = PricingType;
