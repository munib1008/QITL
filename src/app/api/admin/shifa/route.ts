import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { buildRow, RECORD_TYPE_KEYS, REVIEWED_TYPES, type RecordType } from "@/lib/shifa/editor";

const Create = z.object({
  type: z.enum(RECORD_TYPE_KEYS as [RecordType, ...RecordType[]]),
  id: z.string().uuid().optional(),
  data: z.record(z.unknown()),
});

/**
 * Create or edit a Shifa draft (editors only). The row is validated here and again by the database; status moves through
 * /api/admin/status, and publishing needs the reviews the record's layers require, for the version being published.
 * Editing a record or its layers makes it a new version, so an earlier approval no longer counts.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const c = await parseBody(req, Create);
  if (isResponse(c)) return c;
  const built = buildRow(c.type, c.data);
  if (!built.ok) return fail(422, "invalid", built.issues.join("; "), built.issues);
  const reviewed = (REVIEWED_TYPES as readonly string[]).includes(c.type);
  let q;
  if (c.id) {
    // Never move a record between statuses here, and never touch a published one.
    const { status: _status, ...patch } = built.row;
    q = a.sb.from(built.table).update(patch).eq("id", c.id);
    if (reviewed) q = q.neq("status", "published");
  } else {
    q = a.sb.from(built.table).insert(built.row);
  }
  const { data, error } = await q.select(reviewed ? "id, status" : "id").maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "Not found, already published (start a correction first), or you cannot change it.");
  return json({ record: data }, c.id ? 200 : 201);
}
