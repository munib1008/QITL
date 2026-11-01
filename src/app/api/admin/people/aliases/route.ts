import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { AliasRemoveSchema, AliasSchema } from "@/lib/people-admin/form";
import { refusal } from "@/lib/people-admin/server";

/** The person must exist and must not be published: the aliases of a published person change only after a correction. */
async function editable(sb: SupabaseClient, personId: string) {
  const { data, error } = await sb.from("people").select("status").eq("id", personId).maybeSingle();
  if (error) return refusal(error);
  if (!data) return fail(404, "not_found", "Not found, or you cannot see it.");
  if ((data as { status: string }).status === "published") return fail(409, "published", "A published person is read-only. Move it to correction first.");
  return null;
}

/** Add an alias (a spelling or another name, with its language) to a person. Editors only. */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const c = await parseBody(req, AliasSchema);
  if (isResponse(c)) return c;
  const blocked = await editable(a.sb, c.personId);
  if (blocked) return blocked;
  const { error } = await a.sb.from("person_aliases").insert({ person_id: c.personId, alias: c.alias, language: c.language });
  if (error) return refusal(error);
  return json({ ok: true }, 201);
}

/** Remove an alias. Editors only. */
export async function DELETE(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const c = await parseBody(req, AliasRemoveSchema);
  if (isResponse(c)) return c;
  const blocked = await editable(a.sb, c.personId);
  if (blocked) return blocked;
  const { error } = await a.sb.from("person_aliases").delete().eq("person_id", c.personId).eq("alias", c.alias);
  if (error) return refusal(error);
  return json({ ok: true });
}
