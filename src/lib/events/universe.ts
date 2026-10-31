import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import { e2eFixturesEnabled } from "@/lib/e2e-fixtures";
import { TRACK_IDS, isTrack, type TrackId } from "./tracks";
import type { ConnectionLink, OrderView, UniverseCounts, UniverseEvent, VerseRef } from "./model";
import { fixtureCounts, fixtureEvents } from "./fixtures";

/**
 * Reads for the Complete Timeline. Only published rows reach the public client (row-level security), and the
 * counts come from a table that holds numbers only. Pages using these are rendered per request (the nonce CSP makes
 * every page dynamic, docs/SECURITY.md); the data itself is small and read in one query.
 */

type Row = {
  id: string;
  slug: string;
  title: string;
  title_ar: string | null;
  track: string;
  category: UniverseEvent["category"];
  ordering_kind: UniverseEvent["ordering_kind"];
  relative_position: number | null;
  name_source: UniverseEvent["name_source"];
  start_year: number | null;
  end_year: number | null;
  start_ah: number | null;
  end_ah: number | null;
  dating_method: string | null;
  evidence_claims: { evidence: UniverseEvent["evidence"] } | null;
  event_verse_refs: Array<VerseRef & { position: number }>;
  event_identifications: Array<{ kind: string; subject: string; view: string; standing: string; status: string }>;
  event_connections: Array<{
    kind: ConnectionLink["kind"];
    target_kind: ConnectionLink["target_kind"];
    status: string;
    people: { slug: string; name_en: string } | null;
    locations: { slug: string; name_en: string } | null;
    target: { slug: string; title: string; track: string } | null;
  }>;
};

export const UNIVERSE_SELECT =
  "id, slug, title, title_ar, track, category, ordering_kind, relative_position, name_source, start_year, end_year, start_ah, end_ah, dating_method, " +
  "evidence_claims!historical_events_claim_id_fkey(evidence), event_verse_refs(surah, ayah_from, ayah_to, position), event_identifications(kind, subject, view, standing, status), " +
  "event_connections!event_connections_event_id_fkey(kind, target_kind, status, people(slug, name_en), locations(slug, name_en), target:historical_events!event_connections_target_event_id_fkey(slug, title, track))";

export function toUniverseEvent(r: Row): UniverseEvent | null {
  if (!isTrack(r.track)) return null;
  const connections: ConnectionLink[] = [];
  for (const c of r.event_connections ?? []) {
    if (c.status !== "published") continue;
    const target = c.target_kind === "person" ? c.people : c.target_kind === "place" ? c.locations : c.target ? { slug: c.target.slug, name_en: c.target.title } : null;
    if (target) connections.push({ kind: c.kind, target_kind: c.target_kind, label: target.name_en, slug: target.slug });
  }
  const orderViews: OrderView[] = (r.event_identifications ?? []).filter((i) => i.kind === "ordering" && i.status === "published").map((i) => ({ view: i.view, standing: i.standing }));
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    title_ar: r.title_ar,
    track: r.track,
    category: r.category,
    ordering_kind: r.ordering_kind,
    relative_position: r.relative_position,
    name_source: r.name_source,
    start_year: r.start_year,
    end_year: r.end_year,
    start_ah: r.start_ah,
    end_ah: r.end_ah,
    dating_method: r.dating_method,
    evidence: r.evidence_claims?.evidence ?? null,
    verses: [...(r.event_verse_refs ?? [])].sort((a, b) => a.position - b.position || a.surah - b.surah || a.ayah_from - b.ayah_from).map(({ surah, ayah_from, ayah_to }) => ({ surah, ayah_from, ayah_to })),
    connections,
    orderViews,
  };
}

/** Every published universe item, or null when the database is not configured or the read failed. */
export async function publishedUniverse(): Promise<UniverseEvent[] | null> {
  if (e2eFixturesEnabled()) return fixtureEvents();
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("historical_events").select(UNIVERSE_SELECT).eq("status", "published").not("track", "is", null).limit(1000);
  if (error) return null;
  return ((data ?? []) as unknown as Row[]).map(toUniverseEvent).filter((e): e is UniverseEvent => e !== null);
}

/** Counts only: how many inventory items are published and how many are under review, per track. */
export async function universeCounts(): Promise<UniverseCounts | null> {
  if (e2eFixturesEnabled()) return fixtureCounts();
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("event_universe_stats").select("track, published, under_review");
  if (error || !data) return null;
  const rows = (data as Array<{ track: string; published: number; under_review: number }>).filter((r): r is { track: TrackId; published: number; under_review: number } => isTrack(r.track));
  const byTrack = TRACK_IDS.map((t) => rows.find((r) => r.track === t) ?? { track: t, published: 0, under_review: 0 });
  return { published: byTrack.reduce((s, r) => s + r.published, 0), under_review: byTrack.reduce((s, r) => s + r.under_review, 0), byTrack };
}

export interface UniverseDetail extends UniverseEvent {
  summary: string | null;
  identifications: Array<{ kind: string; subject: string; view: string; standing: string }>;
  stories: Array<{ slug: string; title: string }>;
}

/** One published universe item by slug, with its identification claims and related stories. */
export async function universeEventBySlug(slug: string): Promise<UniverseDetail | null> {
  if (e2eFixturesEnabled()) {
    const e = fixtureEvents().find((x) => x.slug === slug);
    return e
      ? {
          ...e,
          summary: null,
          identifications: e.name_source === "later_tradition" ? [{ kind: "name", subject: "Synthetic test name", view: "A synthetic name from later tradition, for testing only.", standing: "later_tradition" }] : [],
          stories: [],
        }
      : null;
  }
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("historical_events")
    .select(`${UNIVERSE_SELECT}, summary, event_stories(stories(slug, title, status))`)
    .eq("slug", slug)
    .eq("status", "published")
    .not("track", "is", null)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Row & { summary: string | null; event_stories: Array<{ stories: { slug: string; title: string; status: string } | null }> };
  const e = toUniverseEvent(row);
  if (!e) return null;
  return {
    ...e,
    summary: row.summary,
    identifications: (row.event_identifications ?? []).filter((i) => i.status === "published").map(({ kind, subject, view, standing }) => ({ kind, subject, view, standing })),
    stories: (row.event_stories ?? []).flatMap((s) => (s.stories && s.stories.status === "published" ? [{ slug: s.stories.slug, title: s.stories.title }] : [])),
  };
}

/** Where a merged-away slug now lives (published targets only: the policy hides the rest). */
export async function redirectTarget(slug: string): Promise<string | null> {
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data } = await sb.from("event_redirects").select("historical_events(slug)").eq("old_slug", slug).maybeSingle();
  const to = (data as unknown as { historical_events: { slug: string } | null } | null)?.historical_events?.slug;
  return to ?? null;
}
