import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabase } from "@/lib/supabase/server";
import type { EvidenceKind } from "@/content/labels";
import type { Atlas, AtlasResult, CategoryId, CreationStory, Entry, EvidenceClass, FieldKey, ItemKind, Profile, Ref, Relationship, RefNodeKind, Visual } from "./creation-types";
import { ITEM_TABLES, ITEM_KINDS } from "./creation-types";
export * from "./creation-types";

/**
 * Published Creation Atlas content. Reads go through the anonymous client, so RLS returns only rows that are
 * published (items also need a published profile); the explicit status filters repeat that rule.
 */

const CLAIM =
  "evidence_claims(claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, locator, sources(work), hadith_entries(collection_id, canonical_number), hadith_gradings(grade_label, grader)))";

interface ClaimRow {
  claim_references: Array<{
    kind: string;
    quran_surah: number | null;
    quran_ayah_from: number | null;
    quran_ayah_to: number | null;
    locator: string | null;
    sources: { work: string } | null;
    hadith_entries: { collection_id: string; canonical_number: string } | null;
    hadith_gradings: { grade_label: string; grader: string } | null;
  }>;
}

export function claimRefs(c: ClaimRow | null | undefined): Ref[] {
  return (c?.claim_references ?? []).map((r) => ({
    kind: r.kind,
    surah: r.quran_surah,
    from: r.quran_ayah_from,
    to: r.quran_ayah_to,
    locator: r.locator,
    work: r.sources?.work ?? null,
    hadith: r.hadith_entries
      ? { collection: r.hadith_entries.collection_id, number: r.hadith_entries.canonical_number, grade: r.hadith_gradings?.grade_label ?? null, grader: r.hadith_gradings?.grader ?? null }
      : null,
  }));
}

const EXTRA: Partial<Record<ItemKind, string>> = { characteristic: "field_key, ", misconception: "question, ", lesson: "everyday_application, " };

interface ItemRow {
  id: string;
  profile_id: string;
  position: number;
  title: string | null;
  body_md: string;
  known: boolean;
  evidence_class: EvidenceClass;
  field_key?: FieldKey;
  question?: string;
  everyday_application?: string | null;
  evidence_claims: ClaimRow | null;
}

function toEntry(kind: ItemKind, r: ItemRow): Entry {
  return {
    id: r.id,
    kind,
    profileId: r.profile_id,
    fieldKey: kind === "characteristic" ? (r.field_key ?? null) : null,
    position: r.position,
    title: r.title,
    bodyMd: r.body_md,
    known: r.known,
    evidence: r.evidence_class,
    refs: claimRefs(r.evidence_claims),
    question: r.question ?? null,
    everydayApplication: r.everyday_application ?? null,
  };
}

async function load(sb: SupabaseClient, slug?: string): Promise<Atlas | null> {
  let pq = sb.from("creation_profiles").select("id, slug, category_id, name_en, name_ar, classification, version, updated_at").eq("status", "published").order("name_en");
  if (slug) pq = pq.eq("slug", slug);
  const pr = await pq;
  if (pr.error) throw pr.error;
  type PRow = { id: string; slug: string; category_id: CategoryId; name_en: string; name_ar: string; classification: string | null; version: number; updated_at: string };
  const prows = (pr.data ?? []) as PRow[];
  if (slug && !prows.length) return null;
  const ids = prows.map((p) => p.id);

  const items = await Promise.all(
    ITEM_KINDS.map(async (kind) => {
      let q = sb.from(ITEM_TABLES[kind]).select(`id, profile_id, position, title, body_md, known, evidence_class, ${EXTRA[kind] ?? ""}${CLAIM}`).eq("status", "published").order("position");
      if (slug) q = q.in("profile_id", ids);
      const r = await q;
      if (r.error) throw r.error;
      return ((r.data ?? []) as unknown as ItemRow[]).map((row) => toEntry(kind, row));
    }),
  );
  const entries = items.flat();

  let rq = sb.from("creation_relationships").select(`id, from_kind, from_ref, relation, to_kind, to_ref, evidence_class, ${CLAIM}`).eq("status", "published").order("created_at");
  if (slug) rq = rq.or(`and(from_kind.eq.creation,from_ref.eq.${slug}),and(to_kind.eq.creation,to_ref.eq.${slug})`);
  let sq = sb.from("creation_stories").select(`id, slug, title, title_ar, summary, profile_id, position, ${CLAIM.replace("evidence_claims(", "evidence_claims(evidence, ")}`).eq("status", "published").order("position");
  if (slug) sq = sq.in("profile_id", ids);
  let vq = sb.from("creation_visual_assets").select("id, profile_id, story_id, kind, animation_key, alt_text, assets(storage_path)").eq("status", "published");
  if (slug) vq = vq.in("profile_id", ids);
  const [rr, sr, vr] = await Promise.all([rq, sq, vq]);
  if (rr.error) throw rr.error;
  if (sr.error) throw sr.error;
  if (vr.error) throw vr.error;

  type RRow = { id: string; from_kind: RefNodeKind; from_ref: string; relation: string; to_kind: RefNodeKind; to_ref: string; evidence_class: EvidenceClass; evidence_claims: ClaimRow | null };
  const relationships: Relationship[] = ((rr.data ?? []) as unknown as RRow[]).map((r) => ({
    id: r.id,
    fromKind: r.from_kind,
    fromRef: r.from_ref,
    relation: r.relation,
    toKind: r.to_kind,
    toRef: r.to_ref,
    evidence: r.evidence_class,
    refs: claimRefs(r.evidence_claims),
  }));
  type SRow = { id: string; slug: string; title: string; title_ar: string | null; summary: string | null; profile_id: string | null; position: number; evidence_claims: (ClaimRow & { evidence: EvidenceKind }) | null };
  const stories: CreationStory[] = ((sr.data ?? []) as unknown as SRow[]).map((s) => {
    const refs = claimRefs(s.evidence_claims);
    return {
      id: s.id,
      slug: s.slug,
      title: s.title,
      titleAr: s.title_ar,
      summary: s.summary,
      profileId: s.profile_id,
      position: s.position,
      claimEvidence: s.evidence_claims?.evidence ?? null,
      refs,
    };
  });
  type VRow = { id: string; profile_id: string | null; story_id: string | null; kind: Visual["kind"]; animation_key: string | null; alt_text: string; assets: { storage_path: string } | null };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const visuals: Visual[] = ((vr.data ?? []) as unknown as VRow[]).map((v) => ({
    id: v.id,
    profileId: v.profile_id,
    storyId: v.story_id,
    kind: v.kind,
    animationKey: v.animation_key,
    alt: v.alt_text,
    imageUrl: v.assets && base ? `${base}/storage/v1/object/public/media/${v.assets.storage_path}` : null,
  }));

  const profiles: Profile[] = prows.map((p) => ({
    id: p.id,
    slug: p.slug,
    categoryId: p.category_id,
    nameEn: p.name_en,
    nameAr: p.name_ar,
    classification: p.classification,
    version: p.version,
    updatedAt: p.updated_at,
    entries: entries.filter((e) => e.profileId === p.id),
  }));
  return { profiles, relationships, stories, visuals };
}

/** Everything published, for the atlas home. */
export async function getAtlas(): Promise<AtlasResult> {
  const sb = getPublicSupabase();
  if (!sb) return { state: "not_configured" };
  try {
    return { state: "ok", atlas: (await load(sb))! };
  } catch {
    return { state: "error" };
  }
}

/** One published profile with its published entries, relationships, stories and visuals; null when not published. */
export async function getCreationProfile(slug: string): Promise<{ state: "not_configured" } | { state: "error" } | { state: "ok"; atlas: Atlas | null }> {
  const sb = getPublicSupabase();
  if (!sb) return { state: "not_configured" };
  try {
    return { state: "ok", atlas: await load(sb, slug) };
  } catch {
    return { state: "error" };
  }
}
