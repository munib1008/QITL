import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import { draftToDoc, docToListItem, type DraftTopic } from "@/lib/science/seed";
import { loadSeedFromDisk } from "@/lib/science/seed-node";
import type { OpenQuestionItem, TimelineTopic, TopicDoc, TopicListItem } from "@/lib/science/model";

/**
 * Reads of the Quran & Science module. Everything comes through the public_science_* database functions: the tables stay closed
 * to visitors. When no database is connected (or a call fails) the pages show the designed "not connected" state AND the draft
 * inventory kept in the repository, labelled as such (origin "draft_file"); a connected database is never supplemented from the file.
 */
export const SLUG = /^[a-z][a-z0-9-]{1,80}$/;

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null } | null> {
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc(fn, args);
  if (error) return null;
  return { data: (data ?? null) as T | null };
}

let drafts: DraftTopic[] | null | undefined;
function draftInventory(): DraftTopic[] {
  if (drafts === undefined) {
    try {
      drafts = loadSeedFromDisk();
    } catch {
      drafts = null;
    }
  }
  return drafts ?? [];
}

export interface Listed<T> {
  /** false = no database answered; items then come from the draft inventory */
  connected: boolean;
  items: T[];
}

export async function scienceTopics(): Promise<Listed<TopicListItem>> {
  const r = await rpc<TopicListItem[]>("public_science_topics");
  if (r) return { connected: true, items: (r.data ?? []).map((t) => ({ ...t, origin: "database" as const })) };
  return { connected: false, items: draftInventory().map((t) => docToListItem(draftToDoc(t))) };
}

/** undefined = no such visible topic. */
export async function scienceTopic(slug: string): Promise<{ connected: boolean; doc: TopicDoc } | undefined> {
  if (!SLUG.test(slug)) return undefined;
  const r = await rpc<TopicDoc>("public_science_topic", { p_slug: slug });
  if (r) return r.data ? { connected: true, doc: { ...r.data, origin: "database" } } : undefined;
  const d = draftInventory().find((t) => t.slug === slug);
  return d ? { connected: false, doc: draftToDoc(d) } : undefined;
}

export async function scienceQuestions(): Promise<Listed<OpenQuestionItem>> {
  const r = await rpc<OpenQuestionItem[]>("public_science_questions");
  if (r) return { connected: true, items: r.data ?? [] };
  const items = draftInventory().flatMap((t) => {
    const d = draftToDoc(t);
    return d.open_questions.map((q) => ({ ...q, topic: d.slug, topic_title: d.title, topic_kind: d.topic_kind, scholarly_status: d.scholarly_status, scientific_review: d.scientific_review, published: false }));
  });
  return { connected: false, items };
}

export async function scienceTimeline(): Promise<Listed<TimelineTopic>> {
  const r = await rpc<TimelineTopic[]>("public_science_timeline");
  if (r) return { connected: true, items: r.data ?? [] };
  const items = draftInventory().map((t) => {
    const d = draftToDoc(t);
    return {
      slug: d.slug,
      title: d.title,
      topic_kind: d.topic_kind,
      scholarly_status: d.scholarly_status,
      scientific_review: d.scientific_review,
      published: false,
      layer_a: d.links.map((l) => ({ surah: l.surah, ayah: l.ayah, era: null, scholar: null, work: null, proposed_after_discovery: null })),
      layer_b: d.milestones,
    } satisfies TimelineTopic;
  });
  return { connected: false, items };
}
