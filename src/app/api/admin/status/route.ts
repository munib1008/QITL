import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";

const TABLE = {
  claim: "evidence_claims",
  story: "stories",
  chapter: "chapters",
  event: "historical_events",
  relationship: "relationships",
  place_geometry: "place_geometries",
  person: "people",
  profile_section: "profile_sections",
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
  const { data, error } = await a.sb.from(TABLE[c.entityType]).update({ status: c.status }).eq("id", c.entityId).select("id, status").maybeSingle();
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
