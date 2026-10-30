import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { buildRow } from "@/lib/lifestyle/editor";
import { RECORD_TYPE_KEYS, type RecordType } from "@/lib/lifestyle/model";

const Create = z.object({
  type: z.enum(RECORD_TYPE_KEYS as [RecordType, ...RecordType[]]),
  id: z.string().uuid().optional(),
  data: z.record(z.unknown()),
});

/**
 * Create or edit a Life Through the Ages draft (editors only). The row is validated here and again by the database;
 * status moves through /api/admin/status, and publishing needs the reviews the record's evidence classes require.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const c = await parseBody(req, Create);
  if (isResponse(c)) return c;
  const built = buildRow(c.type, c.data);
  if (!built.ok) return fail(422, "invalid", built.issues.join("; "), built.issues);
  const q = c.id
    ? a.sb.from(built.table).update({ ...built.row, status: undefined }).eq("id", c.id).neq("status", "published")
    : a.sb.from(built.table).insert(built.row);
  const { data, error } = await q.select("id, status").maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "Not found, already published (start a correction first), or you cannot change it.");
  return json({ record: data }, c.id ? 200 : 201);
}
