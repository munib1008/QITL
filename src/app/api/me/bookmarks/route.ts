import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, parseQuery, requireUser } from "@/lib/api";
import { BookmarkTarget } from "@/lib/validation";

/** GET ?type&id → {saved}; GET without params → the user's bookmarks. RLS limits rows to the owner. */
export async function GET(req: NextRequest) {
  const a = await requireUser(req, { mutation: false });
  if (isResponse(a)) return a;
  if (req.nextUrl.searchParams.has("type")) {
    const q = parseQuery(req, BookmarkTarget);
    if (isResponse(q)) return q;
    const { data, error } = await a.sb.from("bookmarks").select("id").eq("target_type", q.type).eq("target_id", q.id).maybeSingle();
    if (error) return dbError(error);
    return json({ saved: Boolean(data) });
  }
  const { data, error } = await a.sb.from("bookmarks").select("id, target_type, target_id, created_at").order("created_at", { ascending: false }).limit(5000);
  if (error) return dbError(error);
  return json({ bookmarks: data });
}

/** Idempotent save: a repeat click returns 200 rather than creating a duplicate. */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const t = await parseBody(req, BookmarkTarget);
  if (isResponse(t)) return t;
  const { error } = await a.sb
    .from("bookmarks")
    .upsert({ user_id: a.user.id, target_type: t.type, target_id: t.id }, { onConflict: "user_id,target_type,target_id", ignoreDuplicates: true });
  if (error) return dbError(error);
  return json({ saved: true }, 201);
}

export async function DELETE(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const t = await parseBody(req, BookmarkTarget);
  if (isResponse(t)) return t;
  const { error } = await a.sb.from("bookmarks").delete().eq("target_type", t.type).eq("target_id", t.id);
  if (error) return dbError(error);
  return json({ saved: false });
}
