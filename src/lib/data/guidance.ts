import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import { isIconKey, SLUG_RE, type GuidanceLesson, type GuidanceLinkRow, type GuidanceTopic, type SafetyNote, type TopicPage } from "@/lib/guidance/topics";

const TOPIC_COLS = "id, slug, title_en, title_ar, summary_en, summary_ar, icon_key, distress, position, version, updated_at";

function topicRow(r: Record<string, unknown>): GuidanceTopic {
  const t = r as unknown as GuidanceTopic;
  return { ...t, icon_key: isIconKey(String(t.icon_key)) ? t.icon_key : "star" };
}

/** Published topics, in editorial order. Null when the database is not connected (or the read failed). */
export async function publishedTopics(): Promise<GuidanceTopic[] | null> {
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("guidance_topics").select(TOPIC_COLS).eq("status", "published").order("position").limit(200);
  if (error) return null;
  return (data ?? []).map(topicRow);
}

/**
 * One published topic with its published lessons (and their claims, references and gradings), related links and
 * safety notes. RLS returns only what any visitor may see. Null = not connected; undefined = no such published topic.
 */
export async function topicPage(slug: string): Promise<TopicPage | null | undefined> {
  if (!SLUG_RE.test(slug)) return undefined;
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data: t, error } = await sb.from("guidance_topics").select(TOPIC_COLS).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) return null;
  if (!t) return undefined;
  const topic = topicRow(t);
  const [lessons, links, safety] = await Promise.all([
    sb
      .from("guidance_lessons")
      .select(
        "id, position, title_en, title_ar, application_en, application_ar, version, guidance_lesson_claims(id, layer, scholar_name, work_title, locator, position, evidence_claims(id, statement, evidence, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, locator, hadith_entries(collection_id, canonical_number), hadith_gradings(grader, grade_label), sources(work))))",
      )
      .eq("topic_id", topic.id)
      .eq("status", "published")
      .order("position"),
    sb
      .from("guidance_links")
      .select("id, target_kind, note_en, note_ar, position, people(slug, name_en, name_ar, kind), historical_events(slug, title, title_ar), stories(slug, title, title_ar), creation_profiles(slug, name_en, name_ar)")
      .eq("topic_id", topic.id)
      .eq("status", "published")
      .order("position"),
    sb.from("guidance_safety_notes").select("id, kind, body_en, body_ar, position").eq("topic_id", topic.id).eq("status", "published").order("position"),
  ]);
  return {
    topic,
    lessons: (lessons.data ?? []) as unknown as GuidanceLesson[],
    links: (links.data ?? []) as unknown as GuidanceLinkRow[],
    safety: (safety.data ?? []) as unknown as SafetyNote[],
  };
}
