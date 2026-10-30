import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { NotePatch } from "@/lib/validation";

const Id = z.string().uuid();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Id.safeParse(id).success) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const n = await parseBody(req, NotePatch);
  if (isResponse(n)) return n;
  const { data, error } = await a.sb.from("private_notes").update({ body: n.body }).eq("id", id).select("id, updated_at").maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "Not found.");
  return json({ note: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Id.safeParse(id).success) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const { error } = await a.sb.from("private_notes").delete().eq("id", id);
  if (error) return dbError(error);
  return json({ deleted: true });
}
