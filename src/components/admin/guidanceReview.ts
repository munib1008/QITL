import type { SupabaseClient } from "@supabase/supabase-js";
import type { EditorialState } from "@/components/ui/evidence";

export type GuidanceReviewKind = "guidance_topic" | "guidance_lesson" | "guidance_link" | "guidance_safety_note";

export interface GuidanceReviewable {
  id: string;
  status: EditorialState;
  kind: GuidanceReviewKind;
  label: string;
  detail?: string;
}

interface LessonRow {
  id: string;
  status: EditorialState;
  title_en: string;
  application_en: string;
  guidance_topics: { title_en: string } | null;
  guidance_lesson_claims: Array<{ layer: string; scholar_name: string | null; work_title: string | null; evidence_claims: { status: string } | null }>;
}

/** What a reviewer needs to see before approving a lesson: its layers, and whether every claim is approved. */
export function lessonDetail(r: Pick<LessonRow, "application_en" | "guidance_lesson_claims">): string {
  const rev = r.guidance_lesson_claims.filter((c) => c.layer === "revelation");
  const sch = r.guidance_lesson_claims.filter((c) => c.layer === "scholarly_interpretation");
  const pending = r.guidance_lesson_claims.filter((c) => !["approved", "published"].includes(c.evidence_claims?.status ?? "")).length;
  const scholars = sch.map((c) => `${c.scholar_name ?? "?"} (${c.work_title ?? "?"})`).join(", ");
  return [
    `Revelation claims: ${rev.length}`,
    `Scholarly explanations: ${sch.length}${scholars ? ` — ${scholars}` : ""}`,
    pending ? `${pending} claim(s) not yet approved` : "All claims approved",
    r.application_en.trim() ? `Application (QITL suggestion): ${r.application_en.slice(0, 200)}` : "No everyday application yet",
  ].join(" · ");
}

/** Life Guidance entries for the shared review queue (staff RLS returns drafts too). */
export async function loadGuidanceReviewables(c: SupabaseClient, open: string[]): Promise<GuidanceReviewable[]> {
  const [topics, lessons, links, notes] = await Promise.all([
    c.from("guidance_topics").select("id, status, slug, title_en, title_ar, distress").in("status", open).limit(100),
    c
      .from("guidance_lessons")
      .select("id, status, title_en, application_en, guidance_topics(title_en), guidance_lesson_claims(layer, scholar_name, work_title, evidence_claims(status))")
      .in("status", open)
      .limit(200),
    c.from("guidance_links").select("id, status, target_kind, guidance_topics(title_en)").in("status", open).limit(200),
    c.from("guidance_safety_notes").select("id, status, kind, body_en, guidance_topics(title_en)").in("status", open).limit(100),
  ]);
  const out: GuidanceReviewable[] = [];
  for (const r of (topics.data ?? []) as Array<{ id: string; status: EditorialState; slug: string; title_en: string; title_ar: string; distress: boolean }>)
    out.push({
      id: r.id,
      status: r.status,
      kind: "guidance_topic",
      label: `Guidance topic: ${r.title_en} · ${r.title_ar}`,
      detail: `/guidance/${r.slug}${r.distress ? " · distress topic: needs a published medical / mental-health safety note" : ""}`,
    });
  for (const r of (lessons.data ?? []) as unknown as LessonRow[])
    out.push({ id: r.id, status: r.status, kind: "guidance_lesson", label: `${r.guidance_topics?.title_en ?? "Topic"} · ${r.title_en}`, detail: lessonDetail(r) });
  for (const r of (links.data ?? []) as unknown as Array<{ id: string; status: EditorialState; target_kind: string; guidance_topics: { title_en: string } | null }>)
    out.push({ id: r.id, status: r.status, kind: "guidance_link", label: `${r.guidance_topics?.title_en ?? "Topic"} → related ${r.target_kind}` });
  for (const r of (notes.data ?? []) as unknown as Array<{ id: string; status: EditorialState; kind: string; body_en: string; guidance_topics: { title_en: string } | null }>)
    out.push({ id: r.id, status: r.status, kind: "guidance_safety_note", label: `${r.guidance_topics?.title_en ?? "Topic"} · safety note (${r.kind.replace("_", " ")})`, detail: r.body_en.slice(0, 240) });
  return out;
}
