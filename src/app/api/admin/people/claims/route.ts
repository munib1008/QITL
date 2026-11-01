import type { NextRequest } from "next/server";
import { fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { PersonClaimRemoveSchema, PersonClaimSchema } from "@/lib/people-admin/form";
import { refusal } from "@/lib/people-admin/server";

/**
 * Attach an existing evidence claim to a person. Editors only. The claim is picked, never written here: its Quran
 * references live on the claim itself, so no verse can be typed in this screen. The database refuses a change to a
 * published person's claims, and refuses to publish a person whose claims are missing or not approved.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const c = await parseBody(req, PersonClaimSchema);
  if (isResponse(c)) return c;
  const { data: claim, error: e0 } = await a.sb.from("evidence_claims").select("id").eq("id", c.claimId).maybeSingle();
  if (e0) return refusal(e0);
  if (!claim) return fail(404, "claim_not_found", "That evidence claim does not exist (or you cannot see it).");
  const { data, error } = await a.sb
    .from("person_claims")
    .insert({ person_id: c.personId, claim_id: c.claimId, ...(c.position ? { position: c.position } : {}) })
    .select("id")
    .single();
  if (error) return refusal(error);
  return json({ record: data }, 201);
}

/** Detach a claim from a person (not the claim itself). Editors only. */
export async function DELETE(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const c = await parseBody(req, PersonClaimRemoveSchema);
  if (isResponse(c)) return c;
  const { data, error } = await a.sb.from("person_claims").delete().eq("id", c.id).select("id");
  if (error) return refusal(error);
  if (!data?.length) return fail(404, "not_found", "Not found, or you cannot change it.");
  return json({ ok: true });
}
