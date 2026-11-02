"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { AvailabilityRow, ContactRow, PartnerRow, PricingRow, QualificationRow, ServiceRow, VerificationRow } from "@/lib/partners/types";

export interface MemberRow {
  partner_id: string;
  user_id: string;
  role: "owner" | "admin" | "instructor" | "inquiry_manager";
}
export interface NoteRow {
  id: number;
  subject: string;
  note: string;
  created_at: string;
}
export interface InquiryRow {
  id: string;
  service_id: string | null;
  learner_alias: string | null;
  for_child: boolean;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}
export interface DashData {
  partner: PartnerRow;
  members: MemberRow[];
  contacts: ContactRow[];
  services: ServiceRow[];
  pricing: PricingRow[];
  availability: AvailabilityRow[];
  quals: QualificationRow[];
  documents: string[]; // qualification ids that have an uploaded file
  verifications: VerificationRow[];
  notes: NoteRow[];
  inquiries: InquiryRow[];
}

/**
 * Everything the provider dashboard shows for one listing, read through the signed-in browser client so row level
 * security decides what each member role gets back (an instructor receives no private contacts, no documents, no inquiries).
 */
export function useDashData(partnerId: string) {
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setError(true);
      return;
    }
    const one = await sb.from("learning_partners").select("id, slug, display_name, provider_type, country, city, service_area, languages, short_description, long_description, years_experience, listing_status, approved_at, updated_at").eq("id", partnerId).maybeSingle();
    if (one.error || !one.data) {
      setError(true);
      return;
    }
    const [members, contacts, services, quals, files, vers, notes, inquiries] = await Promise.all([
      sb.from("partner_members").select("partner_id, user_id, role").eq("partner_id", partnerId),
      sb.from("partner_contact_methods").select("id, partner_id, kind, label, value, is_public").eq("partner_id", partnerId).order("created_at"),
      sb.from("partner_services").select("id, partner_id, category_id, title, description, level, audience, mode, group_type, duration_minutes, language, status").eq("partner_id", partnerId).order("created_at"),
      sb.from("partner_qualifications").select("id, partner_id, kind, title, issuer, year, claim, status, show_publicly").eq("partner_id", partnerId).order("created_at"),
      sb.from("partner_qualification_files").select("qualification_id").eq("partner_id", partnerId),
      sb.from("partner_verifications").select("id, partner_id, kind, status, scope_statement, requested_at, decided_at").eq("partner_id", partnerId),
      sb.from("partner_review_notes").select("id, subject, note, created_at").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(50),
      sb.from("partner_inquiries").select("id, service_id, learner_alias, for_child, subject, message, status, created_at").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(100),
    ]);
    const svc = (services.data ?? []) as ServiceRow[];
    const ids = svc.map((s) => s.id);
    const [pricing, availability] = ids.length
      ? await Promise.all([
          sb.from("partner_service_pricing").select("id, service_id, pricing_type, currency, amount, unit, classes_included, registration_fee, materials_fee, fees_note, updated_at").in("service_id", ids),
          sb.from("partner_service_availability").select("id, service_id, weekday, start_time, end_time, timezone, note").in("service_id", ids).order("weekday"),
        ])
      : [{ data: [] }, { data: [] }];
    setData({
      partner: one.data as PartnerRow,
      members: (members.data ?? []) as MemberRow[],
      contacts: (contacts.data ?? []) as ContactRow[],
      services: svc,
      pricing: (pricing.data ?? []) as PricingRow[],
      availability: (availability.data ?? []) as AvailabilityRow[],
      quals: (quals.data ?? []) as QualificationRow[],
      documents: ((files.data ?? []) as Array<{ qualification_id: string }>).map((f) => f.qualification_id),
      verifications: (vers.data ?? []) as VerificationRow[],
      notes: (notes.data ?? []) as NoteRow[],
      inquiries: (inquiries.data ?? []) as InquiryRow[],
    });
    setError(false);
  }, [partnerId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, reload };
}
