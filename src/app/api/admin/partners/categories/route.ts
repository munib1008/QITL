import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/admin";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { CategoryInput, CategoryPatch, MergeInput } from "@/lib/partners/validation";

/**
 * The service taxonomy, managed without a code change. Administrators only. POST adds a subject, PATCH ?id= renames,
 * reorders, hides or shows one, PUT merges one subject into another (every course moves; the old one is hidden and keeps
 * pointing at its successor).
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "admin");
  if (isResponse(a)) return a;
  const b = await parseBody(req, CategoryInput);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb.from("partner_service_categories").insert(b).select().single();
  if (error) return dbError(error);
  return json({ ok: true, row: data }, 201);
}

export async function PATCH(req: NextRequest) {
  const a = await requireRole(req, "admin");
  if (isResponse(a)) return a;
  const id = z.string().uuid().safeParse(req.nextUrl.searchParams.get("id"));
  if (!id.success) return fail(422, "invalid", "The request is not valid.");
  const b = await parseBody(req, CategoryPatch);
  if (isResponse(b)) return b;
  if (!Object.keys(b).length) return fail(422, "invalid", "Nothing to change.");
  const { data, error } = await a.sb.from("partner_service_categories").update(b).eq("id", id.data).select();
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ ok: true, row: data[0] });
}

export async function PUT(req: NextRequest) {
  const a = await requireRole(req, "admin");
  if (isResponse(a)) return a;
  const b = await parseBody(req, MergeInput);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb.rpc("partner_merge_category", { p_from: b.from, p_to: b.into });
  if (error) return error.code === "42501" ? fail(403, "forbidden", error.message) : dbError(error);
  return json({ ok: true, moved: data });
}
