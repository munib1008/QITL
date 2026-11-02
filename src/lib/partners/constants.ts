/**
 * Learning Partners: the closed vocabularies. They mirror the CHECK constraints of migration 20261031002800
 * (supabase/migrations/20261031002800_learning_partners.sql); tests/unit/partners.test.ts keeps the two in step.
 * QITL is not a payment platform: nothing here models a payment, an order, a commission or an invoice.
 */

export const PROVIDER_TYPES = [
  "islamic_institution",
  "quran_center",
  "arabic_institute",
  "independent_quran_teacher",
  "independent_arabic_tutor",
  "islamic_studies_educator",
  "community_org",
  "nonprofit_initiative",
  "online_provider",
] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const LISTING_STATUSES = ["draft", "submitted", "information_requested", "under_verification", "approved", "changes_requested", "suspended", "rejected"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const MEMBER_ROLES = ["owner", "admin", "instructor", "inquiry_manager"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
/** Roles an owner can add (the owner row is created with the listing). */
export const ADDABLE_ROLES = ["admin", "instructor", "inquiry_manager"] as const;

export const CONTACT_KINDS = ["email", "phone", "whatsapp", "telegram", "website", "social", "address"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const TRACKS = ["quran", "arabic", "islamic"] as const;
export type Track = (typeof TRACKS)[number];

export const SERVICE_MODES = ["online", "in_person", "hybrid"] as const;
export const GROUP_TYPES = ["individual", "group", "both"] as const;
export const LEVELS = ["beginner", "intermediate", "advanced", "all_levels"] as const;
export const AUDIENCES = ["all", "children", "teens", "adults"] as const;
export const SERVICE_STATUSES = ["draft", "published", "paused", "archived"] as const;

export const PRICING_TYPES = ["free", "per_class", "hourly", "monthly", "course", "package", "donation", "on_request"] as const;
export type PricingType = (typeof PRICING_TYPES)[number];
/** Types that carry no amount, currency, unit or fee (the database enforces it too). */
export const UNPRICED_TYPES: readonly PricingType[] = ["free", "donation", "on_request"];
export const UNIT_FOR: Record<Exclude<PricingType, "free" | "donation" | "on_request">, "class" | "hour" | "month" | "course" | "package"> = {
  per_class: "class",
  hourly: "hour",
  monthly: "month",
  course: "course",
  package: "package",
};

export const INQUIRY_STATUSES = ["new", "viewed", "responded", "follow_up", "closed", "spam"] as const;
/** Statuses an inquiry manager may set (never back to "new"). */
export const PARTNER_SET_STATUSES = ["viewed", "responded", "follow_up", "closed", "spam"] as const;

export const VERIFICATION_KINDS = ["identity", "qualifications", "religious_scholarly"] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];
export const VERIFICATION_STATUSES = ["requested", "in_review", "verified", "rejected", "revoked"] as const;

export const QUALIFICATION_KINDS = ["ijazah", "degree", "certificate", "other"] as const;
export const QUALIFICATION_STATUSES = ["unverified", "verified", "rejected"] as const;

export const REPORT_REASONS = ["misleading_claims", "inappropriate_conduct", "safeguarding", "payment_pressure", "impersonation", "other"] as const;
export const REPORT_STATUSES = ["open", "reviewing", "actioned", "dismissed"] as const;

/** Version of the consent text shown on the inquiry form; stored with each inquiry. */
export const INQUIRY_CONSENT_VERSION = "v1";

export const CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD", "AED", "SAR", "QAR", "KWD", "PKR", "INR", "BDT", "EGP", "TRY", "MYR", "IDR", "NGN", "ZAR"] as const;

/** Interface languages offered as a teaching/contact language (ISO 639 codes). */
export const LANGUAGE_CODES = ["ar", "en", "ur", "hi", "bn", "fr", "tr", "id", "ms", "so", "sw", "ha", "fa", "ps", "de", "es", "ru", "zh"] as const;

export const MAX_DIRECTORY_ROWS = 500;

/** The four statements the module must always show. They live in the i18n module (partnersStrings); these are the keys. */
export const REQUIRED_NOTICES = ["payments", "verification", "instructionNotFatwa", "providerClaims"] as const;
