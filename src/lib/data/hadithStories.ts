import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import { e2eFixturesEnabled } from "@/lib/e2e-fixtures";
import { STORY_DETAIL_SELECT, STORY_LIST_SELECT, storyDetail, storyListItem, type StoryRow } from "@/lib/encyclopedia/mapping";
import { fixtureCounts, fixtureStories, fixtureStory } from "@/lib/encyclopedia/fixtures";
import { SLUG_RE, type EncyclopediaCounts, type LicenceRow, type StoryDetail, type StoryListItem } from "@/lib/encyclopedia/model";

/**
 * Reads for the hadith stories pages. Only the public (anonymous) client is used, so row-level security returns published
 * stories and their published parts and nothing else; a null result means the database is not connected or the read failed.
 * The narration text is carried only where content_permissions allows it (see storyDetail).
 */

/** Published stories, newest titles first by slug. Null when the database is not connected. */
export async function publishedStories(): Promise<StoryListItem[] | null> {
  if (e2eFixturesEnabled()) return fixtureStories();
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("hadith_stories").select(STORY_LIST_SELECT).eq("status", "published").order("title_en").limit(500);
  if (error) return null;
  return ((data ?? []) as unknown as StoryRow[]).map(storyListItem).filter((s): s is StoryListItem => s !== null);
}

/** Counts only (published, under review): the designed empty state shows these and no title. */
export async function storyCounts(): Promise<EncyclopediaCounts | null> {
  if (e2eFixturesEnabled()) return fixtureCounts("hadith_story");
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("encyclopedia_stats").select("published, under_review").eq("kind", "hadith_story").maybeSingle();
  if (error || !data) return null;
  const d = data as { published: number; under_review: number };
  return { published: Number(d.published), under_review: Number(d.under_review) };
}

/** One published story. Null = not connected; undefined = no such published story. */
export async function storyBySlug(slug: string): Promise<StoryDetail | null | undefined> {
  if (!SLUG_RE.test(slug)) return undefined;
  if (e2eFixturesEnabled()) return fixtureStory(slug);
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("hadith_stories").select(STORY_DETAIL_SELECT).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) return null;
  if (!data) return undefined;
  const row = data as unknown as StoryRow;
  const sources = new Set<string>();
  for (const e of row.hadith_story_entries ?? []) {
    if (e.hadith_entries?.source_versions?.source_id) sources.add(e.hadith_entries.source_versions.source_id);
    for (const t of e.hadith_entries?.hadith_translations ?? []) sources.add(t.source_id);
  }
  let licences: LicenceRow[] = [];
  if (sources.size) {
    const { data: perms } = await sb.from("content_permissions").select("source_id, asset_type, scope, status, attribution_text").in("source_id", [...sources]);
    licences = (perms ?? []) as unknown as LicenceRow[];
  }
  return storyDetail(row, licences) ?? undefined;
}

/** Published stories linked to a person, community or event, for the "Hadith stories" block of those pages. */
export async function storiesLinkedTo(target: { personId?: string; communityId?: string; eventId?: string }): Promise<StoryListItem[]> {
  const sb = getPublicSupabase();
  if (!sb) return [];
  const col = target.personId ? "person_id" : target.communityId ? "community_id" : target.eventId ? "event_id" : null;
  const id = target.personId ?? target.communityId ?? target.eventId;
  if (!col || !id) return [];
  const { data: links } = await sb.from("hadith_story_links").select("story_id").eq(col, id).limit(50);
  const ids = [...new Set(((links ?? []) as Array<{ story_id: string }>).map((l) => l.story_id))];
  if (!ids.length) return [];
  const { data, error } = await sb.from("hadith_stories").select(STORY_LIST_SELECT).in("id", ids).eq("status", "published").order("title_en");
  if (error) return [];
  return ((data ?? []) as unknown as StoryRow[]).map(storyListItem).filter((s): s is StoryListItem => s !== null);
}
