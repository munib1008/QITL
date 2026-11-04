import "server-only";
import { creationDrafts, guidanceDrafts } from "@/lib/sourced/data";
import { lifestyleDrafts } from "@/lib/lifestyle/draft-data";
import { DRAFT_INDEX } from "@/lib/stories/draft-data";
import { PLANNED_TOPICS } from "@/lib/guidance/topics";
import { FIELD_KEYS } from "@/lib/lifestyle/model";

/**
 * One evidence graph over the Quran-cited content: every story draft, Creation Atlas profile, Life Guidance lesson and
 * "How They Lived" profile is a node, and two nodes are related when they cite the SAME ayah. The only edge is a shared
 * citation: nothing is inferred from wording or similarity, and the graph never links content to a verse it does not cite.
 */
export type NodeKind = "story" | "creation" | "guidance" | "lifestyle";

export interface GraphNode {
  kind: NodeKind;
  slug: string;
  title: string;
  href: string;
}
interface Indexed extends GraphNode {
  ayat: Set<string>;
}

export interface Related {
  node: GraphNode;
  /** Ayat both nodes cite. */
  shared: number;
  /** A few of the shared ayat as "surah:ayah", in Quran order. */
  sample: string[];
}

const id = (k: NodeKind, slug: string) => `${k}:${slug}`;
const expand = (set: Set<string>, surah: number, from: number, to: number) => {
  for (let a = from; a <= to && a - from < 400; a++) set.add(`${surah}:${a}`);
};

let nodes: Map<string, Indexed> | undefined;
let byAyah: Map<string, string[]> | undefined;

function build() {
  const m = new Map<string, Indexed>();
  for (const s of DRAFT_INDEX.stories) {
    const ayat = new Set<string>();
    for (const c of s.chapters) for (const v of c.verses ?? []) expand(ayat, v.surah, v.from, v.to ?? v.from);
    m.set(id("story", s.slug), { kind: "story", slug: s.slug, title: s.title_en, href: `/drafts/${s.slug}`, ayat });
  }
  for (const d of creationDrafts().values()) {
    const ayat = new Set<string>();
    for (const f of Object.values(d.fields)) if (f.status === "stated") for (const r of f.refs) expand(ayat, r.surah, r.from, r.to);
    m.set(id("creation", d.slug), { kind: "creation", slug: d.slug, title: d.name_en, href: `/creation/${d.slug}`, ayat });
  }
  for (const d of guidanceDrafts().values()) {
    const ayat = new Set<string>();
    for (const f of Object.values(d.fields)) if (f.status === "stated") for (const r of f.refs) expand(ayat, r.surah, r.from, r.to);
    const topic = PLANNED_TOPICS.find((t) => t.slug === d.slug);
    m.set(id("guidance", d.slug), { kind: "guidance", slug: d.slug, title: topic?.title_en ?? d.slug, href: `/guidance/${d.slug}`, ayat });
  }
  for (const d of lifestyleDrafts().values()) {
    const ayat = new Set<string>();
    for (const k of FIELD_KEYS) {
      const f = d.fields[k];
      if (f.status === "stated") for (const r of f.refs) expand(ayat, r.surah, r.from, r.to);
    }
    const story = DRAFT_INDEX.stories.find((s) => s.slug === d.slug);
    m.set(id("lifestyle", d.slug), { kind: "lifestyle", slug: d.slug, title: story?.title_en ?? d.slug, href: `/life-through-ages/prophets/${d.slug}`, ayat });
  }
  const inv = new Map<string, string[]>();
  for (const [nid, n] of m) for (const a of n.ayat) (inv.get(a) ?? inv.set(a, []).get(a)!).push(nid);
  nodes = m;
  byAyah = inv;
}

const ayahOrder = (a: string, b: string) => {
  const [sa, aa] = a.split(":").map(Number) as [number, number];
  const [sb, ab] = b.split(":").map(Number) as [number, number];
  return sa - sb || aa - ab;
};

/**
 * The nodes that share at least `min` cited ayat with this one, most shared first (ties by title). `allowStories`, when given,
 * limits story nodes to the drafts the database released publicly; the other kinds are file-based drafts shown as such.
 */
export function relatedNodes(kind: NodeKind, slug: string, opts: { allowStories?: ReadonlySet<string> | null; limit?: number; min?: number } = {}): Related[] {
  if (!nodes) build();
  const self = nodes!.get(id(kind, slug));
  if (!self) return [];
  const counts = new Map<string, string[]>();
  for (const a of self.ayat) for (const other of byAyah!.get(a) ?? []) if (other !== id(kind, slug)) (counts.get(other) ?? counts.set(other, []).get(other)!).push(a);
  const min = opts.min ?? 1;
  const out: Related[] = [];
  for (const [oid, shared] of counts) {
    const n = nodes!.get(oid)!;
    if (shared.length < min) continue;
    if (n.kind === "story" && opts.allowStories && !opts.allowStories.has(n.slug)) continue;
    out.push({ node: { kind: n.kind, slug: n.slug, title: n.title, href: n.href }, shared: shared.length, sample: shared.sort(ayahOrder).slice(0, 4) });
  }
  out.sort((a, b) => b.shared - a.shared || a.node.title.localeCompare(b.node.title));
  return out.slice(0, opts.limit ?? 6);
}

/** Every node, for tests and the route map. */
export function allNodes(): GraphNode[] {
  if (!nodes) build();
  return [...nodes!.values()].map(({ kind, slug, title, href }) => ({ kind, slug, title, href }));
}
