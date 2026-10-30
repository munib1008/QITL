import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import type { EvidenceBlock, FieldKey, Layer, LifespanRecord } from "./model";

/**
 * Published Life Through the Ages records, read with the anonymous client: RLS returns only published rows (and
 * profile fields / food links only when their parent is published). Nothing is invented when a read fails or the
 * database is not configured: the pages render their designed empty states instead.
 */
export type Loaded<T> = { state: "not_configured" } | { state: "error" } | { state: "ok"; data: T };

const EVIDENCE = "evidence_category, claim_id, primary_citation, publication, dating_method, geographic_relevance, confidence, language, last_reviewed_at, limitations, is_reconstruction";

export interface Era {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string | null;
  relative_order: number | null;
}

export interface TopicRecord extends EvidenceBlock {
  id: string;
  title: string;
  title_ar: string | null;
  body: string;
  era_id: string | null;
  comparison_band?: "ancient" | "documented" | "contemporary" | null;
}

export interface ProfileField extends EvidenceBlock {
  id: string;
  field_key: FieldKey;
  position: number;
  body_md: string;
  known: boolean;
}

export interface Profile {
  id: string;
  person_slug: string;
  fields: ProfileField[];
}

export interface Food extends EvidenceBlock {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string | null;
  food_group: string;
  summary: string | null;
  links: Array<EvidenceBlock & { id: string; link_kind: string; statement: string; health_claim: boolean }>;
}

export interface Reconstruction extends EvidenceBlock {
  id: string;
  slug: string;
  kind: string;
  title_en: string;
  title_ar: string | null;
  intro_md: string;
  segments: Array<{ part: string; text: string }>;
  limitations_md: string;
  era_id: string | null;
}

async function run<T>(fn: (sb: NonNullable<ReturnType<typeof getPublicSupabase>>) => Promise<T | null>): Promise<Loaded<T>> {
  const sb = getPublicSupabase();
  if (!sb) return { state: "not_configured" };
  try {
    const data = await fn(sb);
    return data === null ? { state: "error" } : { state: "ok", data };
  } catch {
    return { state: "error" };
  }
}

export function getProfiles(slugs: string[]): Promise<Loaded<Profile[]>> {
  return run(async (sb) => {
    const { data, error } = await sb
      .from("prophet_lifestyle_profiles")
      .select(`id, person_slug, prophet_lifestyle_fields(id, field_key, position, body_md, known, ${EVIDENCE})`)
      .in("person_slug", slugs)
      .eq("status", "published");
    if (error) return null;
    return ((data ?? []) as unknown as Array<{ id: string; person_slug: string; prophet_lifestyle_fields: ProfileField[] }>).map((p) => ({
      id: p.id,
      person_slug: p.person_slug,
      fields: [...(p.prophet_lifestyle_fields ?? [])].sort((a, b) => a.position - b.position),
    }));
  });
}

export function getFoods(): Promise<Loaded<Food[]>> {
  return run(async (sb) => {
    const { data, error } = await sb
      .from("historical_foods")
      .select(`id, slug, name_en, name_ar, food_group, summary, ${EVIDENCE}, food_evidence_links(id, link_kind, statement, health_claim, ${EVIDENCE})`)
      .eq("status", "published")
      .order("name_en");
    if (error) return null;
    return ((data ?? []) as unknown as Array<Omit<Food, "links"> & { food_evidence_links: Food["links"] }>).map(({ food_evidence_links, ...f }) => ({ ...f, links: food_evidence_links ?? [] }));
  });
}

export function getReconstructions(kind?: string): Promise<Loaded<Reconstruction[]>> {
  return run(async (sb) => {
    let q = sb.from("historical_reconstructions").select(`id, slug, kind, title_en, title_ar, intro_md, segments, limitations_md, era_id, ${EVIDENCE}`).eq("status", "published");
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q.order("title_en");
    if (error) return null;
    return (data ?? []) as unknown as Reconstruction[];
  });
}

export function getLifespanClaims(personId?: string): Promise<Loaded<LifespanRecord[]>> {
  return run(async (sb) => {
    let q = sb.from("historical_lifespan_claims").select(`id, kind, measure, statement, population, value_years, value_low, value_high, value_note, ${EVIDENCE}`).eq("status", "published");
    if (personId) q = q.eq("person_id", personId);
    const { data, error } = await q;
    if (error) return null;
    return (data ?? []) as unknown as LifespanRecord[];
  });
}

export function getEras(): Promise<Loaded<Era[]>> {
  return run(async (sb) => {
    const { data, error } = await sb.from("historical_eras").select("id, slug, name_en, name_ar, relative_order").eq("status", "published").order("relative_order", { nullsFirst: false });
    if (error) return null;
    return (data ?? []) as Era[];
  });
}

const LAYER_SOURCES: Record<Exclude<Layer, "prophets">, { table: string; title: string; titleAr: string; body: string; filter?: [string, string] }> = {
  lifestyle: { table: "historical_daily_activities", title: "title_en", titleAr: "title_ar", body: "body_md" },
  food: { table: "historical_foods", title: "name_en", titleAr: "name_ar", body: "summary" },
  housing: { table: "historical_housing", title: "title_en", titleAr: "title_ar", body: "body_md" },
  trade: { table: "historical_occupations", title: "title_en", titleAr: "title_ar", body: "body_md", filter: ["domain", "trade"] },
  transport: { table: "historical_transport", title: "title_en", titleAr: "title_ar", body: "body_md" },
  health: { table: "historical_health_conditions", title: "title_en", titleAr: "title_ar", body: "body_md" },
  lifespan: { table: "historical_lifespan_claims", title: "statement", titleAr: "statement", body: "value_note" },
};

/** Published records for a timeline layer, with their era (relative order only; never a date for a prophet). */
export function getLayerRecords(layer: Exclude<Layer, "prophets">): Promise<Loaded<TopicRecord[]>> {
  const src = LAYER_SOURCES[layer];
  return run(async (sb) => {
    const hasEra = layer !== "food";
    const cols = [...new Set(["id", src.title, src.titleAr, src.body, ...(hasEra ? ["era_id"] : [])])].join(", ");
    let q = sb.from(src.table).select(`${cols}, ${EVIDENCE}`).eq("status", "published");
    if (src.filter) q = q.eq(src.filter[0], src.filter[1]);
    const { data, error } = await q.limit(200);
    if (error) return null;
    return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
      ...(r as unknown as EvidenceBlock),
      id: String(r.id),
      title: String(r[src.title] ?? ""),
      title_ar: src.titleAr === src.title ? null : ((r[src.titleAr] as string | null) ?? null),
      body: String(r[src.body] ?? ""),
      era_id: (r.era_id as string | null) ?? null,
      comparison_band: (r.comparison_band as TopicRecord["comparison_band"]) ?? null,
    }));
  });
}

/** Topic tables used by the comparison tool: each with its own evidence. */
export function getTopicRecords(table: "historical_occupations" | "historical_housing" | "historical_transport" | "historical_daily_activities" | "historical_health_conditions"): Promise<Loaded<TopicRecord[]>> {
  return run(async (sb) => {
    const { data, error } = await sb.from(table).select(`id, title_en, title_ar, body_md, era_id, comparison_band, ${EVIDENCE}`).eq("status", "published").not("comparison_band", "is", null).limit(200);
    if (error) return null;
    return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
      ...(r as unknown as EvidenceBlock),
      id: String(r.id),
      title: String(r.title_en ?? ""),
      title_ar: (r.title_ar as string | null) ?? null,
      body: String(r.body_md ?? ""),
      era_id: (r.era_id as string | null) ?? null,
      comparison_band: (r.comparison_band as TopicRecord["comparison_band"]) ?? null,
    }));
  });
}
