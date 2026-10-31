import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";

export interface LinkedStory {
  slug: string;
  title: string;
  chapters: Array<{ position: number; anchor: string; title: string }>;
}

/**
 * The published stories (and their published chapters) told about a prophet (people.slug) or an event (slug, through
 * event_stories or a chapter's own event link). Titles and anchors only; the text is read on the story page.
 */
export async function getLinkedStories(subject: { person?: string; event?: string }): Promise<LinkedStory[]> {
  const sb = getPublicSupabase();
  if (!sb) return [];
  const cols = "slug, title, chapters(position, anchor, title, status)";
  const rows: Array<{ slug: string; title: string; chapters: Array<{ position: number; anchor: string; title: string; status: string }> }> = [];
  if (subject.person) {
    const { data } = await sb.from("stories").select(`${cols}, people!inner(slug)`).eq("status", "published").eq("people.slug", subject.person);
    rows.push(...((data ?? []) as unknown as typeof rows));
  }
  if (subject.event) {
    const { data: ev } = await sb.from("historical_events").select("id").eq("slug", subject.event).maybeSingle();
    if (ev) {
      const [links, chapters] = await Promise.all([
        sb.from("event_stories").select("story_id").eq("event_id", ev.id),
        sb.from("chapters").select("story_id").eq("event_id", ev.id).eq("status", "published"),
      ]);
      const ids = [...new Set([...(links.data ?? []), ...(chapters.data ?? [])].map((x) => (x as { story_id: string }).story_id))];
      if (ids.length) {
        const { data } = await sb.from("stories").select(cols).eq("status", "published").in("id", ids);
        rows.push(...((data ?? []) as unknown as typeof rows));
      }
    }
  }
  const seen = new Set<string>();
  return rows
    .filter((s) => (seen.has(s.slug) ? false : (seen.add(s.slug), true)))
    .map((s) => ({ slug: s.slug, title: s.title, chapters: s.chapters.filter((c) => c.status === "published").sort((a, b) => a.position - b.position) }))
    .filter((s) => s.chapters.length);
}
