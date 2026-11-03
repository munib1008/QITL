import { z } from "zod";
import inventoryRaw from "@content/events/inventory.draft.json";
import placementRaw from "@content/events/placement.draft.json";
import lastHourRaw from "@content/last-hour/signs.draft.json";
import lineageRaw from "@content/lineage/lineage.draft.json";
import { isTrack, type TrackId } from "@/lib/events/tracks";

/**
 * Typed loaders for the draft content that backs the Complete Timeline, the Last Hour page and the Lineage view when
 * the database has nothing published. Everything here is DRAFT until the scholarly review board approves it: the
 * loaders expose `status` so each page shows the draft banner, and a schema error fails the build.
 * No date is invented: an era is an editorial grouping, and only the dated milestones carry a (labelled) date.
 */

const Ayah = z.string().regex(/^\d{1,3}:\d{1,3}([–-]\d{1,3})?$/, "expected surah:ayah or surah:from–to");

/* ---------- Complete Timeline ---------- */

const Placement = z.object({
  schema: z.literal("qitl.placement.v1"),
  status: z.literal("draft"),
  review: z.object({ state: z.string(), rule: z.string() }),
  eras: z.array(z.object({ k: z.string(), title: z.string(), note: z.string() })),
  placement: z.record(z.string()),
  dated: z.record(z.string()),
  extras: z.array(z.object({ slug: z.string(), title: z.string(), track: z.string(), era: z.string(), date: z.string(), refs: z.array(Ayah) })),
});

export interface DraftItem {
  slug: string;
  title: string;
  track: TrackId;
  era: string;
  refs: string[];
  date: string | null;
}
export interface DraftEra {
  k: string;
  title: string;
  note: string;
}

/** Items the Last Hour page shows instead of the timeline (the release of Ya'juj and Ma'juj is a sign still to come). */
const LAST_HOUR_SLUGS = new Set(["yajuj-and-majuj"]);

export function draftTimeline(): { status: "draft"; eras: DraftEra[]; items: DraftItem[] } {
  const p = Placement.parse(placementRaw);
  const known = new Set(p.eras.map((e) => e.k));
  const items: DraftItem[] = [];
  for (const i of inventoryRaw.items) {
    if (!isTrack(i.track) || LAST_HOUR_SLUGS.has(i.slug)) continue;
    const era = i.track === "parables" ? "x" : (i.track === "seerah" ? "5" : (p.placement[i.slug] ?? "x"));
    if (!known.has(era)) throw new Error(`placement: unknown era ${era} for ${i.slug}`);
    items.push({ slug: i.slug, title: i.title, track: i.track, era, refs: i.refs.map((r) => r.replace(/-/g, "–")), date: p.dated[i.slug] ?? null });
  }
  for (const x of p.extras) {
    if (!isTrack(x.track)) throw new Error(`placement: unknown track ${x.track}`);
    items.push({ slug: x.slug, title: x.title, track: x.track, era: x.era, refs: x.refs, date: x.date });
  }
  return { status: "draft", eras: p.eras, items };
}

/* ---------- Last Hour ---------- */

const Evidence = z.enum(["quran", "hadith", "scholar", "disputed", "estimate", "unknown"]);
const LastHour = z.object({
  schema: z.literal("qitl.lasthour.v1"),
  status: z.literal("draft"),
  review: z.object({ state: z.string(), rule: z.string() }),
  signs: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      major: z.boolean(),
      evidence: z.array(Evidence).min(1),
      refs: z.array(Ayah),
      note: z.string(),
      source: z.string().nullable(),
    }),
  ),
});
export type LastHourSign = z.infer<typeof LastHour>["signs"][number];

export function draftLastHour(): { status: "draft"; signs: LastHourSign[] } {
  const d = LastHour.parse(lastHourRaw);
  return { status: "draft", signs: d.signs };
}

/* ---------- Lineage ---------- */

const LinkClass = z.enum(["quran", "hadith", "scholar", "unknown"]);
const LNode = z.object({
  id: z.string(),
  name: z.string(),
  arabic: z.string(),
  role: z.enum(["prophet", "ancestor", "gap"]),
  link: LinkClass,
  honorific: z.string(),
  subtitle: z.string(),
  evidence: z.array(Evidence).min(1),
  refs: z.array(z.string()),
  note: z.string(),
});
const Lineage = z.object({
  schema: z.literal("qitl.lineage.v1"),
  status: z.literal("draft"),
  review: z.object({ state: z.string(), rule: z.string() }),
  spine: z.array(LNode).min(2),
  branches: z.array(z.object({ title: z.string(), after: z.string(), nodes: z.array(LNode).min(1) })),
});
export type LineageNode = z.infer<typeof LNode>;
export type LineageBranch = z.infer<typeof Lineage>["branches"][number];

export function draftLineage(): { status: "draft"; spine: LineageNode[]; branches: LineageBranch[] } {
  const d = Lineage.parse(lineageRaw);
  const ids = new Set(d.spine.map((n) => n.id));
  for (const b of d.branches) if (!ids.has(b.after)) throw new Error(`lineage: branch after unknown node ${b.after}`);
  return { status: "draft", spine: d.spine, branches: d.branches };
}
