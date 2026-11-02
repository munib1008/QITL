import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAnyRole } from "@/lib/admin";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { AccessLogInput } from "@/lib/partners/validation";

/** Record that staff opened a provider's private data (contacts, documents, inquiries). Called before the page reads it. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAnyRole(req, ["moderator", "admin"]);
  if (isResponse(a)) return a;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return fail(404, "not_found", "Not found.");
  const b = await parseBody(req, AccessLogInput);
  if (isResponse(b)) return b;
  const { error } = await a.sb.rpc("partner_log_access", { p_partner: id.data, p_what: b.what });
  if (error) return dbError(error);
  return json({ ok: true });
}
