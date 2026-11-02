import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { ProfilePatch } from "@/lib/partners/validation";

const Id = z.string().uuid();

/**
 * Edit the profile of a listing (owner or admin member; RLS decides). Editing the name, type, location or descriptions
 * of an APPROVED listing sends it back to review in the database; the response says so.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const id = Id.safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Not found.");
  const b = await parseBody(req, ProfilePatch);
  if (isResponse(b)) return b;
  if (!Object.keys(b).length) return fail(422, "invalid", "Nothing to change.");
  const { data, error } = await a.sb.from("learning_partners").update(b).eq("id", id.data).select("id, listing_status");
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ ok: true, listing_status: data[0]!.listing_status });
}

/** Delete a DRAFT listing (owner only; the database refuses any other status). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const id = Id.safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Not found.");
  const { data, error } = await a.sb.from("learning_partners").delete().eq("id", id.data).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ ok: true });
}
