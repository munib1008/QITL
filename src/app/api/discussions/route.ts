import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, isResponse, json, notConfigured, parseBody, parseQuery, requireUser } from "@/lib/api";
import { getServerSupabase } from "@/lib/supabase/server";
import { BookmarkTargetType, DiscussionInput } from "@/lib/validation";

const ListQuery = z.object({
  contentType: BookmarkTargetType.optional(),
  contentId: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

/** Public: threads, newest first, optionally for one piece of content. */
export async function GET(req: NextRequest) {
  const sb = await getServerSupabase();
  if (!sb) return notConfigured();
  const q = parseQuery(req, ListQuery);
  if (isResponse(q)) return q;
  let query = sb
    .from("discussions")
    .select("id, content_type, content_id, claim_id, title, status, created_at, comments(count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((q.page - 1) * 20, q.page * 20 - 1);
  if (q.contentType) query = query.eq("content_type", q.contentType);
  if (q.contentId) query = query.eq("content_id", q.contentId);
  const { data, error, count } = await query;
  if (error) return dbError(error);
  return json({ discussions: data, total: count ?? 0, page: q.page });
}

export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const d = await parseBody(req, DiscussionInput);
  if (isResponse(d)) return d;
  const { data, error } = await a.sb
    .from("discussions")
    .insert({ content_type: d.contentType, content_id: d.contentId, claim_id: d.claimId ?? null, title: d.title, created_by: a.user.id })
    .select("id")
    .single();
  if (error) return dbError(error);
  await a.sb.from("discussion_follows").upsert({ user_id: a.user.id, discussion_id: data.id }, { ignoreDuplicates: true });
  return json({ id: data.id }, 201);
}
