import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { refusal } from "@/lib/people-admin/server";

const Change = z.object({
  scope: z.enum(["person", "community"]),
  id: z.string().uuid(),
  status: z.enum(["draft", "in_review", "published", "correction"]),
  revisionNote: z.string().trim().max(2000).optional(),
});

/**
 * The same workflow step as /api/admin/status for a person or a community (entity types person and lifestyle_community, the
 * same revision-note rule), with the database's refusal returned whole: "no evidence, no publish: ..." and "no review, no
 * publish: ..." instead of a generic line. Nothing is bypassed: the update runs under the editor's own session, so the
 * publish guards, RLS and the audit triggers decide, exactly as for the shared route.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const c = await parseBody(req, Change);
  if (isResponse(c)) return c;
  if (c.status === "correction" && !c.revisionNote) return fail(422, "note_required", "A correction needs a public revision note.");
  const table = c.scope === "person" ? "people" : "historical_communities";
  const { data, error } = await a.sb.from(table).update({ status: c.status }).eq("id", c.id).select("id, status").maybeSingle();
  if (error) return refusal(error);
  if (!data) return fail(404, "not_found", "Not found, or you cannot change it.");
  if (c.revisionNote) {
    const { error: e2 } = await a.sb
      .from("revision_notes")
      .insert({ entity_type: c.scope === "person" ? "person" : "lifestyle_community", entity_id: c.id, note: c.revisionNote, is_correction: c.status === "correction", public: true, created_by: a.user.id });
    if (e2) return refusal(e2);
  }
  return json({ entity: data });
}
