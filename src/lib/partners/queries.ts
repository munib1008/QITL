import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DIRECTORY_COLUMNS, DIRECTORY_LIMIT } from "./directory";
import type { AvailabilityRow, CategoryRow, ContactRow, DirectoryRow, PartnerRow, PricingRow, QualificationRow, ServiceRow, VerificationRow } from "./types";

/** Server reads for the public pages. The anonymous client sees only what RLS lets any visitor see. */

export const CATEGORY_COLUMNS = "id, slug, track, name_en, name_ar, name_ur, active, sort_order, merged_into";
export const PARTNER_COLUMNS = "id, slug, display_name, provider_type, country, city, service_area, languages, short_description, long_description, years_experience, listing_status, approved_at, updated_at";
export const SERVICE_COLUMNS = "id, partner_id, category_id, title, description, level, audience, mode, group_type, duration_minutes, language, status";
export const PRICING_COLUMNS = "id, service_id, pricing_type, currency, amount, unit, classes_included, registration_fee, materials_fee, fees_note, updated_at";

export async function loadCategories(sb: SupabaseClient): Promise<CategoryRow[]> {
  const { data } = await sb.from("partner_service_categories").select(CATEGORY_COLUMNS).order("sort_order");
  return (data ?? []) as CategoryRow[];
}

export async function loadDirectory(sb: SupabaseClient): Promise<{ rows: DirectoryRow[]; error: boolean }> {
  const { data, error } = await sb.from("partner_directory").select(DIRECTORY_COLUMNS).order("display_name").limit(DIRECTORY_LIMIT);
  return { rows: (data ?? []) as DirectoryRow[], error: Boolean(error) };
}

export interface ProviderPage {
  partner: PartnerRow;
  services: ServiceRow[];
  pricing: PricingRow[];
  availability: AvailabilityRow[];
  contacts: ContactRow[];
  qualifications: QualificationRow[];
  verifications: VerificationRow[];
}

/** One approved provider and everything public about it, or null (not found, or not approved: the database decides). */
export async function loadProvider(sb: SupabaseClient, slug: string): Promise<ProviderPage | null> {
  const { data: partner } = await sb.from("learning_partners").select(PARTNER_COLUMNS).eq("slug", slug).eq("listing_status", "approved").maybeSingle();
  if (!partner) return null;
  const id = (partner as PartnerRow).id;
  const [services, contacts, quals, vers] = await Promise.all([
    sb.from("partner_services").select(SERVICE_COLUMNS).eq("partner_id", id).eq("status", "published").order("created_at"),
    sb.from("partner_contact_methods").select("id, partner_id, kind, label, value, is_public").eq("partner_id", id).eq("is_public", true),
    sb.from("partner_qualifications").select("id, partner_id, kind, title, issuer, year, claim, status, show_publicly").eq("partner_id", id).order("created_at"),
    sb.from("partner_verifications").select("id, partner_id, kind, status, scope_statement, requested_at, decided_at").eq("partner_id", id).eq("status", "verified"),
  ]);
  const svc = (services.data ?? []) as ServiceRow[];
  const ids = svc.map((s) => s.id);
  const [pricing, avail] = ids.length
    ? await Promise.all([sb.from("partner_service_pricing").select(PRICING_COLUMNS).in("service_id", ids), sb.from("partner_service_availability").select("id, service_id, weekday, start_time, end_time, timezone, note").in("service_id", ids).order("weekday")])
    : [{ data: [] }, { data: [] }];
  return {
    partner: partner as PartnerRow,
    services: svc,
    pricing: (pricing.data ?? []) as PricingRow[],
    availability: (avail.data ?? []) as AvailabilityRow[],
    contacts: (contacts.data ?? []) as ContactRow[],
    qualifications: (quals.data ?? []) as QualificationRow[],
    verifications: (vers.data ?? []) as VerificationRow[],
  };
}
