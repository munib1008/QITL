import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { ClaimLink } from "@/lib/production/schemas";

/** Link an approved claim to a scene (editors). The publish guard refuses scripts whose claims are not approved. */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const b = await parseBody(req, ClaimLink);
  if (isResponse(b)) return b;
  const { data: claim } = await a.sb.from("evidence_claims").select("id, status").eq("id", b.claimId).maybeSingle();
  if (!claim) return fail(404, "not_found", "Claim not found.");
  if (!["approved", "published"].includes(claim.status)) return fail(422, "rule", "Only approved claims can support a scene.");
  const { error } = await a.sb.from("scene_claim_references").upsert({ scene_id: b.sceneId, claim_id: b.claimId, anchor: b.anchor ?? null }, { onConflict: "scene_id,claim_id" });
  if (error) return dbError(error);
  return json({ linked: { sceneId: b.sceneId, claimId: b.claimId } }, 201);
}

export async function DELETE(req: NextRequest) {
  const a = await requireRole(req, "editor");
  if (isResponse(a)) return a;
  const b = await parseBody(req, ClaimLink);
  if (isResponse(b)) return b;
  const { error } = await a.sb.from("scene_claim_references").delete().eq("scene_id", b.sceneId).eq("claim_id", b.claimId);
  if (error) return dbError(error);
  return json({ unlinked: true });
}
