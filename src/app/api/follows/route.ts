import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { FollowInput } from "@/lib/validation";

/** Follow or unfollow a thread. Following sends activity to notifications and the digest (see notification prefs). */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const f = await parseBody(req, FollowInput);
  if (isResponse(f)) return f;
  const q = f.follow
    ? a.sb.from("discussion_follows").upsert({ user_id: a.user.id, discussion_id: f.discussionId }, { ignoreDuplicates: true })
    : a.sb.from("discussion_follows").delete().eq("discussion_id", f.discussionId);
  const { error } = await q;
  if (error) return dbError(error);
  return json({ following: f.follow });
}
