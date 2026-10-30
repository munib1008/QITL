import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { CommentPatch } from "@/lib/validation";

const Id = z.string().uuid();

/** Edit: the author, within 30 minutes, while visible (RLS). A revision of the old text is kept. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const { id, commentId } = await params;
  if (!Id.safeParse(id).success || !Id.safeParse(commentId).success) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const p = await parseBody(req, CommentPatch);
  if (isResponse(p)) return p;
  const { data, error } = await a.sb.from("comments").update({ body: p.body }).eq("id", commentId).eq("discussion_id", id).select("id, edited_at").maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(403, "edit_window", "You can edit your own comment for 30 minutes after posting.");
  return json({ comment: data });
}

/** Delete: the author only (RLS). Moderators hide or remove through /api/admin/moderate instead. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const { id, commentId } = await params;
  if (!Id.safeParse(id).success || !Id.safeParse(commentId).success) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const { data, error } = await a.sb.from("comments").delete().eq("id", commentId).eq("discussion_id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail(403, "forbidden", "You can delete only your own comments.");
  return json({ deleted: true });
}
