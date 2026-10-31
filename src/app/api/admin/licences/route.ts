import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { PermissionInput } from "@/lib/qiraat/editor";

const Save = z.object({ id: z.string().uuid().optional(), data: z.unknown() });

/**
 * Create or update a content licence registry row (admins only). APPROVED, and "verify", are stamped by the database
 * with the acting admin and the current time; nobody can type another person's name into verified_by.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "admin");
  if (isResponse(a)) return a;
  const c = await parseBody(req, Save);
  if (isResponse(c)) return c;
  const p = PermissionInput.safeParse(c.data);
  if (!p.success) return fail(422, "invalid", p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), p.error.flatten());
  const { verify, ...row } = p.data;
  const patch = { ...row, ...(verify || row.status === "APPROVED" ? { verified_by: a.user.id } : {}) };
  const q = c.id ? a.sb.from("content_permissions").update(patch).eq("id", c.id) : a.sb.from("content_permissions").insert(patch);
  const { data, error } = await q.select("id, status, verified_by, verified_at").maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "not_found", "Not found, or you cannot change it.");
  return json({ permission: data }, c.id ? 200 : 201);
}
