import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, notConfigured, parseBody, requireUser } from "@/lib/api";
import { getServerSupabase } from "@/lib/supabase/server";
import { CommentInput } from "@/lib/validation";

const Id = z.string().uuid();

/** Public thread. Hidden and removed comments keep their place; the view blanks their body. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Id.safeParse(id).success) return fail(404, "not_found", "Not found.");
  const sb = await getServerSupabase();
  if (!sb) return notConfigured();
  const [{ data: discussion, error: e1 }, { data: comments, error: e2 }] = await Promise.all([
    sb.from("discussions").select("id, content_type, content_id, claim_id, title, status, created_at").eq("id", id).maybeSingle(),
    sb.from("comments_public").select("*").eq("discussion_id", id).order("created_at", { ascending: true }).limit(1000),
  ]);
  if (e1 || e2) return dbError(e1 ?? e2);
  if (!discussion) return fail(404, "not_found", "Not found.");
  return json({ discussion, comments });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Id.safeParse(id).success) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const c = await parseBody(req, CommentInput);
  if (isResponse(c)) return c;
  const { data, error } = await a.sb
    .from("comments")
    .insert({ discussion_id: id, parent_id: c.parentId ?? null, author_id: a.user.id, body: c.body, citation: c.citation ?? null })
    .select("id, created_at")
    .single();
  if (error) return dbError(error);
  return json({ comment: data }, 201);
}
