import "server-only";
import { journeyStops } from "@/content/journey";
import { getPublicSupabase } from "@/lib/supabase/server";
import { e2eFixturesEnabled } from "@/lib/e2e-fixtures";
import {
  CLAIM_SELECT,
  SUBJECT_SELECT,
  communityListItem,
  evidenceBlock,
  familyEdges,
  personListItem,
  relatedEvents,
  subjectItem,
  type ClaimRow,
  type CommunityRow,
  type EdgeRow,
  type PersonRow,
  type SubjectRow,
} from "@/lib/encyclopedia/mapping";
import { fixtureCommunities, fixtureCommunity, fixtureCounts, fixturePeople, fixturePerson } from "@/lib/encyclopedia/fixtures";
import { SLUG_RE, personGroup, type CommunityListItem, type CommunityPage, type EncyclopediaCounts, type EvidenceBlock, type PersonListItem, type PersonPage, type StoryListItem } from "@/lib/encyclopedia/model";
import { storiesLinkedTo } from "./hadithStories";

/**
 * Reads for /people and /communities. Only the anonymous client is used, so row-level security returns published records
 * only: a draft person, community, relationship or event never arrives here. Null = the database is not connected (or the
 * read failed); undefined = no such published record.
 */

const SUBJECT_JOIN = (fk: string) => `subject:historical_events!${fk}(${SUBJECT_SELECT})`;

export async function peopleCounts(): Promise<EncyclopediaCounts | null> {
  return counts("person");
}
export async function communityCounts(): Promise<EncyclopediaCounts | null> {
  return counts("community");
}
async function counts(kind: "person" | "community"): Promise<EncyclopediaCounts | null> {
  if (e2eFixturesEnabled()) return fixtureCounts(kind);
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("encyclopedia_stats").select("published, under_review").eq("kind", kind).maybeSingle();
  if (error || !data) return null;
  const d = data as { published: number; under_review: number };
  return { published: Number(d.published), under_review: Number(d.under_review) };
}

export async function publishedPeople(): Promise<PersonListItem[] | null> {
  if (e2eFixturesEnabled()) return fixturePeople();
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("people")
    .select(`slug, name_en, name_ar, honorific, kind, encyclopedia_kind, ${SUBJECT_JOIN("people_subject_event_id_fkey")}`)
    .eq("status", "published")
    .order("name_en")
    .limit(1000);
  if (error) return null;
  return ((data ?? []) as unknown as PersonRow[]).map(personListItem);
}

export async function publishedCommunities(): Promise<CommunityListItem[] | null> {
  if (e2eFixturesEnabled()) return fixtureCommunities();
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("historical_communities")
    .select(`slug, name_en, name_ar, ${SUBJECT_JOIN("historical_communities_subject_event_id_fkey")}`)
    .eq("status", "published")
    .order("name_en")
    .limit(1000);
  if (error) return null;
  return ((data ?? []) as unknown as CommunityRow[]).map(communityListItem);
}

interface EventLinkRow {
  role?: string | null;
  historical_events: { slug: string; title: string; title_ar: string | null; status?: string } | null;
}

export async function personBySlug(slug: string): Promise<PersonPage | null | undefined> {
  if (!SLUG_RE.test(slug)) return undefined;
  if (e2eFixturesEnabled()) return fixturePerson(slug);
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("people")
    .select(
      `id, slug, name_en, name_ar, honorific, summary, kind, encyclopedia_kind, person_aliases(alias, language), ` +
        `${SUBJECT_JOIN("people_subject_event_id_fkey")}, person_claims(position, evidence_claims(${CLAIM_SELECT}))`,
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) return null;
  if (!data) return undefined;
  const p = data as unknown as PersonRow & { id: string; person_aliases: Array<{ alias: string; language: string }>; person_claims: Array<{ position: number; evidence_claims: ClaimRow | null }> };
  const [edges, evLinks, conns, life] = await Promise.all([
    sb
      .from("relationships")
      .select("kind, confidence, competing_group, from:people!relationships_person_from_fkey(slug, name_en, name_ar), to:people!relationships_person_to_fkey(slug, name_en, name_ar), evidence_claims(statement)")
      .or(`person_from.eq.${p.id},person_to.eq.${p.id}`)
      .eq("status", "published")
      .limit(100),
    sb.from("event_people").select("role, historical_events(slug, title, title_ar, status)").eq("person_id", p.id).limit(100),
    sb.from("event_connections").select("historical_events:historical_events!event_connections_event_id_fkey(slug, title, title_ar, status)").eq("person_id", p.id).eq("status", "published").limit(100),
    sb.from("profile_sections").select("value_text, known").eq("person_id", p.id).eq("kind", "lifespan").eq("status", "published").maybeSingle(),
  ]);
  const subject = subjectItem(p.subject as SubjectRow | null | undefined);
  const evidence = [...p.person_claims].sort((a, b) => a.position - b.position).map((c) => evidenceBlock(c.evidence_claims)).filter((e): e is EvidenceBlock => e !== null);
  const stories: StoryListItem[] = await storiesLinkedTo({ personId: p.id });
  const lifeRow = (life.data ?? null) as { value_text: string | null; known: boolean } | null;
  return {
    slug: p.slug,
    name_en: p.name_en,
    name_ar: p.name_ar,
    honorific: p.honorific,
    summary: p.summary ?? null,
    kind: p.kind,
    encyclopedia_kind: p.encyclopedia_kind,
    group: personGroup(p),
    aliases: p.person_aliases ?? [],
    evidence,
    subject,
    family: familyEdges(p.slug, (edges.data ?? []) as unknown as EdgeRow[]),
    events: relatedEvents([...((evLinks.data ?? []) as unknown as EventLinkRow[]), ...((conns.data ?? []) as unknown as EventLinkRow[])], subject?.slug),
    hadithStories: stories,
    lifespan: lifeRow ? { value: lifeRow.known ? lifeRow.value_text : null, known: lifeRow.known } : null,
    journeyHref: p.kind === "prophet" && journeyStops().some((s) => s.id === p.slug) ? `/prophets/${p.slug}` : null,
  };
}

interface CommunityDetailRow extends CommunityRow {
  id: string;
  summary: string | null;
  claim: ClaimRow | null;
  era: { name_en: string } | null;
  place: { name_en: string } | null;
}

export async function communityBySlug(slug: string): Promise<CommunityPage | null | undefined> {
  if (!SLUG_RE.test(slug)) return undefined;
  if (e2eFixturesEnabled()) return fixtureCommunity(slug);
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("historical_communities")
    .select(
      `id, slug, name_en, name_ar, summary, claim:evidence_claims!historical_communities_claim_id_fkey(${CLAIM_SELECT}), era:historical_eras(name_en), place:locations(name_en), ` +
        SUBJECT_JOIN("historical_communities_subject_event_id_fkey"),
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) return null;
  if (!data) return undefined;
  const c = data as unknown as CommunityDetailRow;
  const subject = subjectItem(c.subject);
  // Events that point at the community's item on the timeline, and the item's own links to other events.
  let events: ReturnType<typeof relatedEvents> = [];
  if (c.subject?.slug) {
    const { data: item } = await sb.from("historical_events").select("id").eq("slug", c.subject.slug).eq("status", "published").maybeSingle();
    const itemId = (item as { id: string } | null)?.id;
    if (itemId) {
      const [into, outof] = await Promise.all([
        sb.from("event_connections").select("historical_events:historical_events!event_connections_event_id_fkey(slug, title, title_ar, status)").eq("target_event_id", itemId).eq("status", "published").limit(100),
        sb.from("event_connections").select("historical_events:historical_events!event_connections_target_event_id_fkey(slug, title, title_ar, status)").eq("event_id", itemId).eq("target_kind", "event").eq("status", "published").limit(100),
      ]);
      events = relatedEvents([...((into.data ?? []) as unknown as EventLinkRow[]), ...((outof.data ?? []) as unknown as EventLinkRow[])], c.subject.slug);
    }
  }
  const ev = evidenceBlock(c.claim);
  const stories = await storiesLinkedTo({ communityId: c.id });
  return { slug: c.slug, name_en: c.name_en, name_ar: c.name_ar, summary: c.summary, era: c.era?.name_en ?? null, place: c.place?.name_en ?? null, evidence: ev ? [ev] : [], subject, events, hadithStories: stories };
}
