import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { DreamReferenceInput } from "@/lib/dreams";
import { citationRow, UUID_RE } from "@/lib/mufti";

/** Add a reference (Quran, hadith record or scholarly work) to the caller's unreleased response. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const c = await parseBody(req, DreamReferenceInput);
  if (isResponse(c)) return c;
  const { data, error } = await a.sb
    .from("dream_reference_links")
    .insert({ response_id: id, ...citationRow(c) })
    .select("id")
    .single();
  if (error) return dbError(error);
  return json({ id: data.id }, 201);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rid = req.nextUrl.searchParams.get("referenceId") ?? "";
  if (!UUID_RE.test(id) || !UUID_RE.test(rid)) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const { data, error } = await a.sb.from("dream_reference_links").delete().eq("id", rid).eq("response_id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ deleted: true });
}
