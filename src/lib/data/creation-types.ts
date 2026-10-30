/**
 * Creation Atlas types, constants and pure helpers shared by server pages, client components and tests (no data
 * access). Mirrors supabase/migrations/20261031001400_creation_atlas.sql.
 */
import type { EvidenceKind } from "@/content/labels";
import { refLabel, type Ref } from "./story-types";
export { refLabel, type Ref } from "./story-types";

export type EvidenceClass = "revelation" | "authentic_hadith" | "scholarly_interpretation" | "not_established";
export const EVIDENCE_CLASSES: EvidenceClass[] = ["revelation", "authentic_hadith", "scholarly_interpretation", "not_established"];
/** The design system's evidence marks for each class (word + mark + border, never colour alone). */
export const EVIDENCE_KIND: Record<EvidenceClass, EvidenceKind> = {
  revelation: "quran",
  authentic_hadith: "hadith",
  scholarly_interpretation: "scholar",
  not_established: "unknown",
};

export type CategoryId = "humans" | "jinn" | "iblis_shayatin" | "angels" | "animals" | "heavens_earth";
/** The six categories, as seeded by the migration (names are interface labels, not claims). */
export const CATEGORIES: Array<{ id: CategoryId; nameEn: string; nameAr: string }> = [
  { id: "humans", nameEn: "Human beings", nameAr: "الإنس" },
  { id: "jinn", nameEn: "Jinn", nameAr: "الجن" },
  { id: "iblis_shayatin", nameEn: "Iblis and the shayatin", nameAr: "إبليس والشياطين" },
  { id: "angels", nameEn: "Angels", nameAr: "الملائكة" },
  { id: "animals", nameEn: "Animals in the Quran", nameAr: "الحيوان في القرآن" },
  { id: "heavens_earth", nameEn: "The heavens, the earth and other creations", nameAr: "السماوات والأرض" },
];

/** Item tables that share one shape (the migration's loop), keyed by the short name used in the app. */
export const ITEM_TABLES = {
  characteristic: "creation_characteristics",
  ability: "creation_abilities",
  limitation: "creation_limitations",
  interaction: "creation_interactions",
  lesson: "creation_lessons",
  misconception: "creation_misconceptions",
  source_reference: "creation_source_references",
} as const;
export type ItemKind = keyof typeof ITEM_TABLES;
export const ITEM_KINDS = Object.keys(ITEM_TABLES) as ItemKind[];

/** Single-value template fields stored on characteristics (field_key). */
export const FIELD_KEYS = ["origin", "purpose", "nature", "relationship_with_humans", "chronological_position", "location", "vocabulary"] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

/** The 17-field profile template, in reading order. */
export const PROFILE_FIELDS = [
  "name",
  "classification",
  "origin",
  "purpose",
  "nature",
  "abilities",
  "limitations",
  "relationship_with_humans",
  "quranic_events",
  "related_hadith",
  "chronological_position",
  "location",
  "misconceptions",
  "lessons",
  "vocabulary",
  "sources",
  "review_status",
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export type RefNodeKind = "creation" | "person" | "event" | "command" | "community" | "concept";

export interface Entry {
  id: string;
  kind: ItemKind;
  profileId: string;
  fieldKey: FieldKey | null;
  position: number;
  title: string | null;
  bodyMd: string;
  known: boolean;
  evidence: EvidenceClass;
  refs: Ref[];
  question: string | null;
  everydayApplication: string | null;
}

export interface Profile {
  id: string;
  slug: string;
  categoryId: CategoryId;
  nameEn: string;
  nameAr: string;
  classification: string | null;
  version: number;
  updatedAt: string;
  entries: Entry[];
}

export interface Relationship {
  id: string;
  fromKind: RefNodeKind;
  fromRef: string;
  relation: string;
  toKind: RefNodeKind;
  toRef: string;
  evidence: EvidenceClass;
  refs: Ref[];
}

export interface CreationStory {
  id: string;
  slug: string;
  title: string;
  titleAr: string | null;
  summary: string | null;
  profileId: string | null;
  position: number;
  /** The evidence label of the story's claim, as recorded on the claim; null when the story has no claim yet. */
  claimEvidence: EvidenceKind | null;
  refs: Ref[];
}

export interface Visual {
  id: string;
  profileId: string | null;
  storyId: string | null;
  kind: "abstract" | "environmental" | "diagram" | "calligraphic";
  animationKey: string | null;
  imageUrl: string | null;
  alt: string;
}

export interface Atlas {
  profiles: Profile[];
  relationships: Relationship[];
  stories: CreationStory[];
  visuals: Visual[];
}

export type AtlasResult = { state: "not_configured" } | { state: "error" } | { state: "ok"; atlas: Atlas };

/* ---------- Comparison ---------- */

export const COMPARE_CATEGORIES = ["humans", "jinn", "angels"] as const satisfies readonly CategoryId[];
export const COMPARE_ROWS = ["origin", "nature", "purpose", "abilities", "limitations", "relationship_with_humans"] as const;
export type CompareRow = (typeof COMPARE_ROWS)[number];

export interface CompareCell {
  entry: Entry | null;
  more: number;
}

/** Entries of a profile that answer a template field, in editorial order. */
export function entriesFor(p: Profile, field: CompareRow | FieldKey | "lessons" | "misconceptions" | "quranic_events" | "sources"): Entry[] {
  const pick = (f: (e: Entry) => boolean) => p.entries.filter(f).sort((a, b) => a.position - b.position);
  switch (field) {
    case "abilities":
      return pick((e) => e.kind === "ability");
    case "limitations":
      return pick((e) => e.kind === "limitation");
    case "lessons":
      return pick((e) => e.kind === "lesson");
    case "misconceptions":
      return pick((e) => e.kind === "misconception");
    case "quranic_events":
      return pick((e) => e.kind === "interaction");
    case "sources":
      return pick((e) => e.kind === "source_reference");
    default:
      return pick((e) => e.kind === "characteristic" && e.fieldKey === field);
  }
}

/**
 * The overview profile of a category is the published profile whose address equals the category id (for example
 * /creation/jinn). The comparison reads only that profile: it never borrows an entry from another profile.
 */
export function overviewProfile(profiles: Profile[], category: CategoryId): Profile | null {
  return profiles.find((p) => p.categoryId === category && p.slug === category.replace(/_/g, "-")) ?? null;
}

export function buildComparison(profiles: Profile[]): { columns: Array<{ category: CategoryId; profile: Profile | null }>; rows: Array<{ row: CompareRow; cells: CompareCell[] }> } {
  const columns = COMPARE_CATEGORIES.map((category) => ({ category, profile: overviewProfile(profiles, category) }));
  const rows = COMPARE_ROWS.map((row) => ({
    row,
    cells: columns.map(({ profile }) => {
      const list = profile ? entriesFor(profile, row) : [];
      return { entry: list[0] ?? null, more: Math.max(0, list.length - 1) };
    }),
  }));
  return { columns, rows };
}

/* ---------- References ---------- */

/** Every distinct reference, Quran first in mushaf order, then hadith, then other works. */
export function collectRefs(lists: Ref[][]): Ref[] {
  const seen = new Map<string, Ref>();
  for (const list of lists) for (const r of list) seen.set(refLabel(r).text, r);
  const rank = (r: Ref) => (r.kind === "quran" ? 0 : r.kind === "hadith" ? 1 : 2);
  return [...seen.values()].sort((a, b) => rank(a) - rank(b) || (a.surah ?? 0) - (b.surah ?? 0) || (a.from ?? 0) - (b.from ?? 0) || refLabel(a).text.localeCompare(refLabel(b).text));
}

export function atlasRefs(a: Atlas): Ref[] {
  return collectRefs([...a.profiles.flatMap((p) => p.entries.map((e) => e.refs)), ...a.relationships.map((r) => r.refs), ...a.stories.map((s) => s.refs)]);
}

/* ---------- Relationship graph ---------- */

export interface GraphNode {
  key: string;
  kind: RefNodeKind;
  ref: string;
  label: string;
  href?: string;
  x: number;
  y: number;
}

export function nodeLabel(kind: RefNodeKind, ref: string, profiles: Profile[], locale: "en" | "ar" = "en"): { label: string; href?: string } {
  if (kind === "creation") {
    const p = profiles.find((x) => x.slug === ref);
    if (p) return { label: locale === "ar" ? p.nameAr : p.nameEn, href: `/creation/${p.slug}` };
  }
  return { label: ref.replace(/[-_]+/g, " ") };
}

/** Nodes on a circle (deterministic order of first appearance), so the diagram is stable between renders. */
export function graphLayout(rels: Relationship[], profiles: Profile[], locale: "en" | "ar" = "en", size = 360): { nodes: GraphNode[]; edges: Array<{ id: string; from: GraphNode; to: GraphNode; relation: string; evidence: EvidenceClass }> } {
  const order: Array<{ kind: RefNodeKind; ref: string }> = [];
  const key = (k: string, r: string) => `${k}:${r}`;
  for (const r of rels)
    for (const [k, ref] of [
      [r.fromKind, r.fromRef],
      [r.toKind, r.toRef],
    ] as Array<[RefNodeKind, string]>)
      if (!order.some((o) => key(o.kind, o.ref) === key(k, ref))) order.push({ kind: k, ref });
  const c = size / 2;
  const radius = order.length > 1 ? size / 2 - 48 : 0;
  const nodes = order.map((o, i) => {
    const a = (2 * Math.PI * i) / Math.max(order.length, 1) - Math.PI / 2;
    return { key: key(o.kind, o.ref), kind: o.kind, ref: o.ref, ...nodeLabel(o.kind, o.ref, profiles, locale), x: Math.round(c + radius * Math.cos(a)), y: Math.round(c + radius * Math.sin(a)) };
  });
  const find = (k: string, r: string) => nodes.find((n) => n.key === key(k, r))!;
  return { nodes, edges: rels.map((r) => ({ id: r.id, from: find(r.fromKind, r.fromRef), to: find(r.toKind, r.toRef), relation: r.relation, evidence: r.evidence })) };
}

/** Relationships that touch one profile, and those that tie it to a Quranic event. */
export function relationshipsOf(rels: Relationship[], slug: string): Relationship[] {
  return rels.filter((r) => (r.fromKind === "creation" && r.fromRef === slug) || (r.toKind === "creation" && r.toRef === slug));
}
export function eventRelationshipsOf(rels: Relationship[], slug: string): Relationship[] {
  return relationshipsOf(rels, slug).filter((r) => r.fromKind === "event" || r.toKind === "event");
}

/* ---------- Animations registered for visual assets ---------- */

/** Animation keys an editor may register (src/components/creation/CreationVisual.tsx draws them). */
export const VISUAL_KEYS = ["orbits", "layered-sky", "water-and-land", "rain-and-growth", "calligraphic-strokes"] as const;
export type VisualKey = (typeof VISUAL_KEYS)[number];
