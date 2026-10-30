import type { SupabaseClient } from "@supabase/supabase-js";
import type { EditorialState } from "@/components/ui/evidence";
import type { EvidenceKind } from "@/content/labels";
import { EVIDENCE_KIND, ITEM_KINDS, ITEM_TABLES, type EvidenceClass, type ItemKind } from "@/lib/data/creation-types";

/** Creation Atlas rows in the review queue. Every one is reviewed under the entity type 'creation'. */
export type CreationReviewKind = `creation_${ItemKind}` | "creation_profile" | "creation_relationship" | "creation_story" | "creation_visual";

export interface CreationReviewable {
  id: string;
  status: EditorialState;
  label: string;
  kind: CreationReviewKind;
  evidence?: EvidenceKind;
  detail?: string;
}

/** The entity type recorded in editorial_reviews for a queue kind. */
export function reviewEntityType<K extends string>(kind: K): K | "creation" {
  return kind.startsWith("creation_") ? "creation" : kind;
}

const OPEN = ["draft", "in_review", "approved", "published", "correction", "rejected"];

export async function loadCreationReviewables(c: SupabaseClient): Promise<CreationReviewable[]> {
  const [profiles, rels, stories, visuals, ...items] = await Promise.all([
    c.from("creation_profiles").select("id, status, slug, name_en, name_ar, category_id").in("status", OPEN).limit(200),
    c.from("creation_relationships").select("id, status, from_kind, from_ref, relation, to_kind, to_ref, evidence_class").in("status", OPEN).limit(200),
    c.from("creation_stories").select("id, status, slug, title").in("status", OPEN).limit(100),
    c.from("creation_visual_assets").select("id, status, kind, animation_key, alt_text").in("status", OPEN).limit(100),
    ...ITEM_KINDS.map((k) =>
      c
        .from(ITEM_TABLES[k])
        .select(`id, status, title, body_md, known, evidence_class, ${k === "characteristic" ? "field_key, " : k === "misconception" ? "question, " : ""}creation_profiles(name_en)`)
        .in("status", OPEN)
        .limit(200),
    ),
  ]);
  const out: CreationReviewable[] = [];
  for (const r of (profiles.data ?? []) as Array<{ id: string; status: EditorialState; slug: string; name_en: string; name_ar: string; category_id: string }>)
    out.push({ id: r.id, status: r.status, kind: "creation_profile", label: `${r.name_en} · ${r.name_ar}`, detail: `Creation profile /creation/${r.slug} (${r.category_id.replace(/_/g, " ")}). Needs a published entry before it can be published.` });
  for (const r of (rels.data ?? []) as Array<{ id: string; status: EditorialState; from_kind: string; from_ref: string; relation: string; to_kind: string; to_ref: string; evidence_class: EvidenceClass }>)
    out.push({ id: r.id, status: r.status, kind: "creation_relationship", label: `${r.from_kind}:${r.from_ref} — ${r.relation} → ${r.to_kind}:${r.to_ref}`, evidence: EVIDENCE_KIND[r.evidence_class] });
  for (const r of (stories.data ?? []) as Array<{ id: string; status: EditorialState; slug: string; title: string }>)
    out.push({ id: r.id, status: r.status, kind: "creation_story", label: `Creation story: ${r.title}`, detail: `/${r.slug}` });
  for (const r of (visuals.data ?? []) as Array<{ id: string; status: EditorialState; kind: string; animation_key: string | null; alt_text: string }>)
    out.push({ id: r.id, status: r.status, kind: "creation_visual", label: `${r.kind}${r.animation_key ? `: ${r.animation_key}` : ""} — ${r.alt_text}`, detail: "Abstract, environmental, calligraphic or diagram only; never a figure of the unseen. Publishing needs an approval first." });
  ITEM_KINDS.forEach((k, i) => {
    type Row = { id: string; status: EditorialState; title: string | null; body_md: string; known: boolean; evidence_class: EvidenceClass; field_key?: string; question?: string; creation_profiles: { name_en: string } | null };
    for (const r of ((items[i]?.data ?? []) as unknown as Row[]))
      out.push({
        id: r.id,
        status: r.status,
        kind: `creation_${k}`,
        label: `${r.creation_profiles?.name_en ?? "Profile"} · ${k.replace(/_/g, " ")}${r.field_key ? ` (${r.field_key.replace(/_/g, " ")})` : ""}${r.question ? `: ${r.question}` : r.title ? `: ${r.title}` : ""}`,
        evidence: EVIDENCE_KIND[r.evidence_class],
        detail: r.known ? r.body_md.slice(0, 240) : "Not established by the selected authentic sources.",
      });
  });
  return out;
}
