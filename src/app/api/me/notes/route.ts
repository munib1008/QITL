import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, parseQuery, requireUser } from "@/lib/api";
import { BookmarkTarget, NoteInput } from "@/lib/validation";

/** Private notes. Owner-only by RLS; bodies are never logged. */
export async function GET(req: NextRequest) {
  const a = await requireUser(req, { mutation: false });
  if (isResponse(a)) return a;
  if (req.nextUrl.searchParams.has("type")) {
    const q = parseQuery(req, BookmarkTarget);
    if (isResponse(q)) return q;
    const { data, error } = await a.sb.from("private_notes").select("id, body, updated_at").eq("target_type", q.type).eq("target_id", q.id).maybeSingle();
    if (error) return dbError(error);
    return json({ note: data });
  }
  const { data, error } = await a.sb.from("private_notes").select("id, target_type, target_id, body, updated_at").order("updated_at", { ascending: false }).limit(500);
  if (error) return dbError(error);
  return json({ notes: data });
}

/** Create or replace the note for a target (autosave). */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const n = await parseBody(req, NoteInput);
  if (isResponse(n)) return n;
  const { data, error } = await a.sb
    .from("private_notes")
    .upsert({ user_id: a.user.id, target_type: n.target.type, target_id: n.target.id, body: n.body }, { onConflict: "user_id,target_type,target_id" })
    .select("id, updated_at")
    .single();
  if (error) return dbError(error);
  return json({ note: data });
}
