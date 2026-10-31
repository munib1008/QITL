import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import { isIconKey, SLUG_RE, type ShifaEntry, type ShifaLinkRow, type ShifaSafetyNote, type ShifaSection, type ShifaTopic, type TopicPage } from "@/lib/shifa/model";

const TOPIC_COLS = "id, slug, section, title_en, title_ar, icon_key, position, version";

function topicRow(r: Record<string, unknown>): ShifaTopic {
  const t = r as unknown as ShifaTopic;
  return { ...t, icon_key: isIconKey(String(t.icon_key)) ? t.icon_key : "leaf" };
}

/** Published topics, in editorial order. Null when the database is not connected (or the read failed). */
export async function publishedTopics(section?: ShifaSection): Promise<ShifaTopic[] | null> {
  const sb = getPublicSupabase();
  if (!sb) return null;
  let q = sb.from("shifa_topics").select(TOPIC_COLS).eq("status", "published");
  if (section) q = q.eq("section", section);
  const { data, error } = await q.order("position").limit(200);
  if (error) return null;
  return (data ?? []).map(topicRow);
}

const CLAIM = "evidence_claims(id, statement, evidence, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, locator, hadith_entries(collection_id, canonical_number), hadith_gradings(grader, grade_label), sources(work)))";

/**
 * One published topic with its published entries (their layers, scholarly notes, claims and references) and safety
 * notes. RLS returns only what any visitor may see. Null = not connected; undefined = no such published topic.
 */
export async function topicPage(slug: string): Promise<TopicPage | null | undefined> {
  if (!SLUG_RE.test(slug)) return undefined;
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data: t, error } = await sb.from("shifa_topics").select(TOPIC_COLS).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) return null;
  if (!t) return undefined;
  const topic = topicRow(t);
  const [entries, safety] = await Promise.all([
    sb
      .from("shifa_entries")
      .select(
        `id, slug, kind, title_en, title_ar, position, version, last_reviewed_at,
         shifa_layers(id, evidence_category, position, finding, publication, citation, study_type, population, limitations, url, states_health_effect, is_traditional, is_hypothesis, language, ${CLAIM}),
         shifa_scholarly_notes(id, scholar_name, work_title, locator, position, ${CLAIM})`,
      )
      .eq("topic_id", topic.id)
      .eq("status", "published")
      .order("position"),
    sb.from("shifa_safety_notes").select("id, entry_id, kind, body_en, body_ar, position").eq("topic_id", topic.id).eq("status", "published").order("position"),
  ]);
  return {
    topic,
    entries: (entries.data ?? []) as unknown as ShifaEntry[],
    safety: (safety.data ?? []) as unknown as ShifaSafetyNote[],
  };
}

/**
 * Published Shifa topics linked to a Life Guidance topic or to a person (by slug), for "related reading". RLS returns a
 * link only when the link and its Shifa topic are both published, so a page never links to an unpublished Shifa page.
 */
export async function relatedShifa(target: { guidanceTopicId: string } | { personSlug: string }): Promise<ShifaLinkRow[]> {
  const sb = getPublicSupabase();
  if (!sb) return [];
  const sel = "id, shifa_topics!inner(slug, section, title_en, title_ar)";
  let q;
  if ("guidanceTopicId" in target) {
    q = sb.from("shifa_links").select(sel).eq("guidance_topic_id", target.guidanceTopicId);
  } else {
    if (!SLUG_RE.test(target.personSlug)) return [];
    const { data: p } = await sb.from("people").select("id").eq("slug", target.personSlug).maybeSingle();
    if (!p) return [];
    q = sb.from("shifa_links").select(sel).eq("person_id", (p as { id: string }).id);
  }
  const { data, error } = await q.eq("status", "published").limit(12);
  if (error) return [];
  return (data ?? []) as unknown as ShifaLinkRow[];
}
