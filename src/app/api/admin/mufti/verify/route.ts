import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { VerifyInput } from "@/lib/mufti";

/**
 * Administrator actions on a mufti profile: verify (after checking credentials), remove verification, grant the
 * mufti role, and grant or remove the separate dream-interpretation qualification. RLS and the qualification
 * trigger accept these from an administrator only.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "admin");
  if (isResponse(a)) return a;
  const b = await parseBody(req, VerifyInput);
  if (isResponse(b)) return b;
  const now = new Date().toISOString();
  if (b.action === "grant_role") {
    const { error } = await a.sb.from("role_assignments").insert({ user_id: b.userId, role: "mufti", granted_by: a.user.id, credential_note: b.note ?? null });
    if (error) return dbError(error);
    return json({ ok: true });
  }
  const patch =
    b.action === "verify"
      ? { verified_by: a.user.id, verified_at: now, verification_note: b.note ?? null }
      : b.action === "unverify"
        ? { verified_by: null, verified_at: null, dream_qualified_by: null, dream_qualified_at: null, dream_qualification_note: null }
        : b.action === "dream_qualify"
          ? { dream_qualified_by: a.user.id, dream_qualified_at: now, dream_qualification_note: b.note ?? null }
          : { dream_qualified_by: null, dream_qualified_at: null, dream_qualification_note: null };
  const { data, error } = await a.sb.from("mufti_profiles").update(patch).eq("user_id", b.userId).select("user_id");
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ ok: true });
}
