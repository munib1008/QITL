import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { buildRow, EDITOR_KIND_KEYS, type EditorKind } from "@/lib/qiraat/editor";

const Save = z.object({
  kind: z.enum(EDITOR_KIND_KEYS as [EditorKind, ...EditorKind[]]),
  id: z.string().uuid().optional(),
  data: z.record(z.unknown()),
});

const NO_STATUS = new Set<EditorKind>(["reading", "variant_claim"]);

/**
 * Create or edit a Qira'at draft (editors only): variants and their readings and explanation claims, transmission
 * routes, misconceptions, reciters and recordings. The database refuses a reading not found in its licensed edition, a
 * recording without the right permission or with a mismatched riwayah, and any edit of a published record.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const c = await parseBody(req, Save);
  if (isResponse(c)) return c;
  const built = buildRow(c.kind, c.data);
  if (!built.ok) return fail(422, "invalid", built.issues.join("; "), built.issues);
  if (c.kind === "variant_claim" && c.id) return fail(422, "invalid", "Explanation links are added or removed, not edited.");
  let q;
  if (c.id) {
    q = a.sb.from(built.table).update(built.row).eq("id", c.id);
    if (!NO_STATUS.has(c.kind)) q = q.neq("status", "published");
  } else {
    q = a.sb.from(built.table).insert(built.row);
  }
  const { data, error } = await q.select(c.kind === "variant_claim" ? "variant_id, claim_id" : "id").maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "Not found, already published (start a correction first), or you cannot change it.");
  return json({ record: data }, c.id ? 200 : 201);
}

const Remove = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("reading"), id: z.string().uuid() }),
  z.object({ kind: z.literal("variant_claim"), variantId: z.string().uuid(), claimId: z.string().uuid() }),
]);

/** Remove a reading or an explanation link from a draft variant (refused once the variant is published). */
export async function DELETE(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const r = await parseBody(req, Remove);
  if (isResponse(r)) return r;
  const q =
    r.kind === "reading"
      ? a.sb.from("qiraat_variant_readings").delete().eq("id", r.id)
      : a.sb.from("qiraat_variant_claims").delete().eq("variant_id", r.variantId).eq("claim_id", r.claimId);
  const { error } = await q;
  if (error) return dbError(error);
  return json({ ok: true });
}
