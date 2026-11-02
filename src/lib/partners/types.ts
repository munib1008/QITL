import type { ContactKind, ListingStatus, PricingType, ProviderType, Track } from "./constants";

/** Row shapes as the public pages read them. Nothing here is private data. */
export interface CategoryRow {
  id: string;
  slug: string;
  track: Track;
  name_en: string;
  name_ar: string;
  name_ur: string;
  active: boolean;
  sort_order: number;
  merged_into: string | null;
}

export interface DirectoryRow {
  id: string;
  slug: string;
  display_name: string;
  provider_type: ProviderType;
  country: string;
  city: string | null;
  service_area: string | null;
  languages: string[];
  short_description: string | null;
  years_experience: number | null;
  approved_at: string | null;
  category_ids: string[];
  modes: string[];
  group_types: string[];
  levels: string[];
  teaching_languages: string[];
  has_free: boolean;
  has_paid: boolean;
  service_count: number;
}

export interface PartnerRow {
  id: string;
  slug: string;
  display_name: string;
  provider_type: ProviderType;
  country: string;
  city: string | null;
  service_area: string | null;
  languages: string[];
  short_description: string | null;
  long_description: string | null;
  years_experience: number | null;
  listing_status: ListingStatus;
  approved_at: string | null;
  updated_at: string;
}

export interface ServiceRow {
  id: string;
  partner_id: string;
  category_id: string;
  title: string;
  description: string | null;
  level: string;
  audience: string;
  mode: string;
  group_type: string;
  duration_minutes: number | null;
  language: string;
  status: string;
}

export interface PricingRow {
  id: string;
  service_id: string;
  pricing_type: PricingType;
  currency: string | null;
  amount: number | string | null;
  unit: string | null;
  classes_included: number | null;
  registration_fee: number | string | null;
  materials_fee: number | string | null;
  fees_note: string | null;
  updated_at: string;
}

export interface AvailabilityRow {
  id: string;
  service_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  timezone: string;
  note: string | null;
}

export interface ContactRow {
  id: string;
  partner_id: string;
  kind: ContactKind;
  label: string | null;
  value: string;
  is_public: boolean;
}

export interface QualificationRow {
  id: string;
  partner_id: string;
  kind: string;
  title: string;
  issuer: string | null;
  year: number | null;
  claim: string | null;
  status: "unverified" | "verified" | "rejected";
  show_publicly: boolean;
}

export interface VerificationRow {
  id: string;
  partner_id: string;
  kind: string;
  status: string;
  scope_statement: string | null;
  requested_at: string;
  decided_at: string | null;
}
