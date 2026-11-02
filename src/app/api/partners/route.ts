import type { NextRequest } from "next/server";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { ProfileInput } from "@/lib/partners/validation";

/**
 * Create a provider listing as a DRAFT. The creator becomes its owner (a database trigger). Nothing is public: the
 * listing appears in the directory only after QITL staff approve it (an administrator decision, partner_transition).
 */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, ProfileInput);
  if (isResponse(b)) return b;
  // No RETURNING: the owner row is written by an AFTER trigger, so the new listing is readable only afterwards.
  const ins = await a.sb.from("learning_partners").insert(b);
  if (ins.error) return dbError(ins.error);
  const { data, error } = await a.sb.from("learning_partners").select("id, slug").eq("slug", b.slug).maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(500, "server_error", "Something went wrong on our side.");
  return json({ ok: true, id: data.id, slug: data.slug }, 201);
}
