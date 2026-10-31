import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { RECORD_TYPES } from "@/lib/lifestyle/model";

const TABLE = {
  claim: "evidence_claims",
  story: "stories",
  chapter: "chapters",
  event: "historical_events",
  relationship: "relationships",
  place_geometry: "place_geometries",
  person: "people",
  story_section: "story_sections",
  quiz: "story_quizzes",
  media: "story_media",
  guidance_topic: "guidance_topics",
  guidance_lesson: "guidance_lessons",
  guidance_link: "guidance_links",
  guidance_safety_note: "guidance_safety_notes",
  // Creation Atlas (every row is reviewed under the entity type 'creation')
  creation_profile: "creation_profiles",
  creation_characteristic: "creation_characteristics",
  creation_ability: "creation_abilities",
  creation_limitation: "creation_limitations",
  creation_interaction: "creation_interactions",
  creation_lesson: "creation_lessons",
  creation_misconception: "creation_misconceptions",
  creation_source_reference: "creation_source_references",
  creation_relationship: "creation_relationships",
  creation_story: "creation_stories",
  creation_visual: "creation_visual_assets",
  // Qira'at (reviewed in editorial_reviews; readers and riwayat are reviewed under qiraat_ref_uuid(kind, id))
  transmission_route: "transmission_routes",
  qiraat_variant: "qiraat_variants",
  qiraat_misconception: "qiraat_misconceptions",
  reciter: "reciters",
  audio_recording: "audio_recordings",
  // Shifa (publishing also needs the religious and/or clinical review, bound to the version being published)
  shifa_topic: "shifa_topics",
  shifa_entry: "shifa_entries",
  shifa_safety_note: "shifa_safety_notes",
  shifa_link: "shifa_links",
  // Complete Timeline & Event Universe (each is reviewed under its own entity type)
  event_identification: "event_identifications",
  event_connection: "event_connections",
  // Life Through the Ages (publishing also needs the religious and/or historical-scientific review).
  ...RECORD_TYPES,
} as const;

const Change = z.object({
  entityType: z.enum(Object.keys(TABLE) as [keyof typeof TABLE, ...Array<keyof typeof TABLE>]),
  entityId: z.string().uuid(),
  status: z.enum(["draft", "in_review", "approved", "published", "correction", "archived"]),
  revisionNote: z.string().trim().max(2000).optional(),
});

/**
 * Move an entity through the workflow. Publishing is refused by the database unless every claim is referenced
 * and approved and a scholarly reviewer approved the entity ("no evidence, no publish").
 * A correction must carry a public revision note.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const c = await parseBody(req, Change);
  if (isResponse(c)) return c;
  if (c.status === "correction" && !c.revisionNote) return fail(422, "note_required", "A correction needs a public revision note.");
  const patch: Record<string, unknown> = { status: c.status };
  if ((c.entityType === "media" || c.entityType === "creation_visual") && c.status === "published") {
    // Published media records the scholarly reviewer whose approval it rests on.
    const { data: rev } = await a.sb
      .from("editorial_reviews")
      .select("reviewer_id, decision")
      .eq("entity_type", c.entityType === "media" ? "media" : "creation")
      .eq("entity_id", c.entityId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!rev || rev.decision !== "approved") return fail(422, "rule", "This media has no scholarly approval yet.");
    patch.approved_by = rev.reviewer_id;
  }
  const { data, error } = await a.sb.from(TABLE[c.entityType]).update(patch).eq("id", c.entityId).select("id, status").maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "Not found, or you cannot change it.");
  if (c.revisionNote) {
    const { error: e2 } = await a.sb
      .from("revision_notes")
      .insert({ entity_type: c.entityType, entity_id: c.entityId, note: c.revisionNote, is_correction: c.status === "correction", public: true, created_by: a.user.id });
    if (e2) return dbError(e2);
  }
  return json({ entity: data });
}
