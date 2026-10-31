import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { CitationInput, citationRow, UUID_RE } from "@/lib/mufti";

/** Add a citation to the caller's unpublished answer (Quran reference, hadith record or scholarly work + locator). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const c = await parseBody(req, CitationInput);
  if (isResponse(c)) return c;
  const { data, error } = await a.sb
    .from("mufti_answer_citations")
    .insert({ answer_id: id, ...citationRow(c) })
    .select("id")
    .single();
  if (error) return dbError(error);
  return json({ id: data.id }, 201);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = req.nextUrl.searchParams.get("citationId") ?? "";
  if (!UUID_RE.test(id) || !UUID_RE.test(cid)) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const { data, error } = await a.sb.from("mufti_answer_citations").delete().eq("id", cid).eq("answer_id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ deleted: true });
}
