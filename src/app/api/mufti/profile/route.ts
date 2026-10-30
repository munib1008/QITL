import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { ProfileInput } from "@/lib/mufti";

/**
 * Create or edit the caller's own mufti profile. Only unverified profiles can be edited by their owner, and only an
 * administrator verifies (RLS and the qualification trigger enforce both).
 */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const p = await parseBody(req, ProfileInput);
  if (isResponse(p)) return p;
  const row = { display_name: p.displayName, madhhab: p.madhhab, credentials_md: p.credentials };
  const { data: existing, error: e1 } = await a.sb.from("mufti_profiles").select("user_id").eq("user_id", a.user.id).maybeSingle();
  if (e1) return dbError(e1);
  const { error } = existing
    ? await a.sb.from("mufti_profiles").update(row).eq("user_id", a.user.id)
    : await a.sb.from("mufti_profiles").insert({ user_id: a.user.id, ...row });
  if (error) return dbError(error);
  return json({ ok: true }, existing ? 200 : 201);
}
