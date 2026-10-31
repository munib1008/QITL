import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { buildRow, RECORD_TYPE_KEYS, type RecordType } from "@/lib/encyclopedia/editor";

const Save = z.object({
  type: z.enum(RECORD_TYPE_KEYS as [RecordType, ...RecordType[]]),
  id: z.string().uuid().optional(),
  data: z.record(z.unknown()),
});

const Remove = z.object({ type: z.enum(RECORD_TYPE_KEYS as [RecordType, ...RecordType[]]).refine((t) => t !== "hadith_story", "stories are archived, not deleted"), id: z.string().uuid() });

/**
 * Create or edit a hadith-story draft or one of its parts (editors only). The row is validated here and again by the
 * database; status moves through /api/admin/status, and publishing needs the scholarly review of the version being
 * published. Editing a draft or any of its parts makes it a new version, so an earlier approval no longer counts; a
 * published story and its parts are frozen by the database until the story is moved to correction.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const c = await parseBody(req, Save);
  if (isResponse(c)) return c;
  const built = buildRow(c.type, c.data);
  if (!built.ok) return fail(422, "invalid", built.issues.join("; "), built.issues);
  let q;
  if (c.id) {
    // Never move a record between statuses here, and never touch a published story.
    const { status: _status, ...patch } = built.row;
    q = a.sb.from(built.table).update(patch).eq("id", c.id);
    if (c.type === "hadith_story") q = q.neq("status", "published");
  } else {
    q = a.sb.from(built.table).insert(built.row);
  }
  const { data, error } = await q.select("id").maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "Not found, already published (start a correction first), or you cannot change it.");
  return json({ record: data }, c.id ? 200 : 201);
}

/** Remove a part of a draft story (the database refuses it once the story is published). */
export async function DELETE(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const c = await parseBody(req, Remove);
  if (isResponse(c)) return c;
  const { error } = await a.sb.from(({ hadith_story_entry: "hadith_story_entries", hadith_story_link: "hadith_story_links", hadith_story_claim: "hadith_story_claims", hadith_story_lesson: "hadith_story_lessons" } as Record<string, string>)[c.type]!).delete().eq("id", c.id);
  if (error) return dbError(error);
  return json({ ok: true });
}
