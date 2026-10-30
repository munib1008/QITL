import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import type { Audience, FactKey, Media, Quiz, Ref, Section, Story } from "./story-types";
import type { EvidenceKind } from "@/content/labels";
export * from "./story-types";

export type StoryResult = { state: "not_configured" } | { state: "error" } | { state: "ok"; story: Story | null };

const CLAIM_SELECT =
  "evidence_claims(evidence, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, locator, sources(work), hadith_entries(collection_id, canonical_number), hadith_gradings(grade_label, grader)))";

interface ClaimRow {
  evidence: EvidenceKind;
  claim_references: Array<{
    kind: string;
    quran_surah: number | null;
    quran_ayah_from: number | null;
    quran_ayah_to: number | null;
    locator: string | null;
    sources: { work: string } | null;
    hadith_entries: { collection_id: string; canonical_number: string } | null;
    hadith_gradings: { grade_label: string; grader: string } | null;
  }>;
}

function refs(c: ClaimRow | null): Ref[] {
  return (c?.claim_references ?? []).map((r) => ({
    kind: r.kind,
    surah: r.quran_surah,
    from: r.quran_ayah_from,
    to: r.quran_ayah_to,
    locator: r.locator,
    work: r.sources?.work ?? null,
    hadith: r.hadith_entries
      ? { collection: r.hadith_entries.collection_id, number: r.hadith_entries.canonical_number, grade: r.hadith_gradings?.grade_label ?? null, grader: r.hadith_gradings?.grader ?? null }
      : null,
  }));
}

/** Published story content for a person (by slug) or an event (by slug). Only reviewed, published rows. */
export async function getStory(subject: { person?: string; event?: string }): Promise<StoryResult> {
  const sb = getPublicSupabase();
  if (!sb) return { state: "not_configured" };
  const join = subject.person ? "people!inner(slug)" : "historical_events!inner(slug)";
  const col = subject.person ? "people.slug" : "historical_events.slug";
  const slug = (subject.person ?? subject.event)!;
  const [s, q, m] = await Promise.all([
    sb
      .from("story_sections")
      .select(`id, section, fact_key, step_group, step_role, position, audience, base_section_id, title, value_text, value_note, known, body_md, everyday_example, ${join}, ${CLAIM_SELECT}`)
      .eq(col, slug)
      .eq("status", "published")
      .order("position"),
    sb
      .from("story_quizzes")
      .select(`id, title, audience, ${join}, quiz_questions(id, position, prompt, options, correct_index, explanation, ${CLAIM_SELECT})`)
      .eq(col, slug)
      .eq("status", "published"),
    sb.from("story_media").select(`id, role, animation_key, caption, alt_text, ${join}, assets(storage_path)`).eq(col, slug).eq("status", "published"),
  ]);
  if (s.error || q.error || m.error) return { state: "error" };
  type SRow = {
    id: string;
    section: string;
    fact_key: FactKey | null;
    step_group: number | null;
    step_role: Section["stepRole"];
    position: number;
    audience: Audience;
    base_section_id: string | null;
    title: string | null;
    value_text: string | null;
    value_note: string | null;
    known: boolean;
    body_md: string;
    everyday_example: string | null;
    evidence_claims: ClaimRow | null;
  };
  const sections: Section[] = ((s.data ?? []) as unknown as SRow[]).map((r) => ({
    id: r.id,
    section: r.section,
    factKey: r.fact_key,
    stepGroup: r.step_group,
    stepRole: r.step_role,
    position: r.position,
    audience: r.audience,
    baseId: r.base_section_id,
    title: r.title,
    valueText: r.value_text,
    valueNote: r.value_note,
    known: r.known,
    bodyMd: r.body_md,
    everydayExample: r.everyday_example,
    evidence: r.evidence_claims?.evidence ?? "unknown",
    refs: refs(r.evidence_claims),
  }));
  type QRow = {
    id: string;
    title: string;
    audience: Audience;
    quiz_questions: Array<{ id: string; position: number; prompt: string; options: string[]; correct_index: number; explanation: string | null; evidence_claims: ClaimRow | null }>;
  };
  const quizzes: Quiz[] = ((q.data ?? []) as unknown as QRow[]).map((z) => ({
    id: z.id,
    title: z.title,
    audience: z.audience,
    questions: [...z.quiz_questions]
      .sort((a, b) => a.position - b.position)
      .map((x) => ({ id: x.id, prompt: x.prompt, options: x.options, correct: x.correct_index, explanation: x.explanation, refs: refs(x.evidence_claims) })),
  }));
  type MRow = { id: string; role: string; animation_key: string | null; caption: string; alt_text: string; assets: { storage_path: string } | null };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const media: Media[] = ((m.data ?? []) as unknown as MRow[]).map((x) => ({
    id: x.id,
    role: x.role,
    animationKey: x.animation_key,
    caption: x.caption,
    alt: x.alt_text,
    imageUrl: x.assets && base ? `${base}/storage/v1/object/public/media/${x.assets.storage_path}` : null,
  }));
  if (!sections.length && !quizzes.length && !media.length) return { state: "ok", story: null };
  return { state: "ok", story: { sections, quizzes, media } };
}

