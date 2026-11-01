import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { MarkReadInput } from "@/lib/mufti-apply";

/** Mark the caller's own notifications read (RLS and a column grant allow nothing but read_at, on own rows). */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, MarkReadInput);
  if (isResponse(b)) return b;
  let q = a.sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", a.user.id).is("read_at", null);
  if (b.ids) q = q.in("id", b.ids);
  const { data, error } = await q.select("id");
  if (error) return dbError(error);
  return json({ ok: true, marked: data?.length ?? 0 });
}
