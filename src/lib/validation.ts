import { z } from "zod";

/** Shared request schemas. Every API route validates its payload with these on the server. */

export const BookmarkTargetType = z.enum(["journey_stop", "story", "chapter", "quran_verse", "hadith", "event", "place", "person"]);
export type BookmarkTargetType = z.infer<typeof BookmarkTargetType>;

export const BookmarkTarget = z.object({
  type: BookmarkTargetType,
  id: z.string().min(1).max(120).regex(/^[A-Za-z0-9:_.-]+$/),
});
export type BookmarkTarget = z.infer<typeof BookmarkTarget>;

export const ProgressPatch = z.object({
  chapterId: z.string().uuid(),
  percent: z.number().min(0).max(100),
});

export const NoteInput = z.object({
  target: BookmarkTarget,
  body: z.string().max(20000),
});
export const NotePatch = z.object({ body: z.string().max(20000) });

export const DiscussionInput = z.object({
  contentType: BookmarkTargetType,
  contentId: z.string().min(1).max(120),
  claimId: z.string().uuid().optional(),
  title: z.string().trim().min(4).max(160),
});

export const CommentInput = z.object({
  body: z.string().trim().min(2).max(5000),
  parentId: z.string().uuid().optional(),
  citation: z
    .string()
    .trim()
    .max(80)
    .regex(/^(Q \d{1,3}:\d{1,3}([–-]\d{1,3})?|[A-Za-z' -]{2,40} \d{1,6}[a-z]?)$/, "a Quran (Q 2:255) or hadith (Bukhari 1) reference")
    .optional(),
});
export const CommentPatch = z.object({ body: z.string().trim().min(2).max(5000) });

export const ReportInput = z.object({
  targetType: z.enum(["comment", "discussion"]),
  targetId: z.string().uuid(),
  reason: z.enum(["misleading", "disrespectful", "spam", "personal_information", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export const FollowInput = z.object({ discussionId: z.string().uuid(), follow: z.boolean() });

/** returnTo must be a same-origin path; anything else falls back to "/". */
export function safeReturnTo(v: string | null | undefined): string {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
  try {
    const u = new URL(v, "http://ziq.local");
    if (u.origin !== "http://ziq.local") return "/";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}

/** A pending signed-out action, carried through sign-in and confirmed by the user afterwards. */
export const Intent = z.object({ action: z.literal("bookmark"), target: BookmarkTarget });
export type Intent = z.infer<typeof Intent>;

export function encodeIntent(i: Intent): string {
  return `${i.action}:${i.target.type}:${i.target.id}`;
}
export function decodeIntent(s: string | null | undefined): Intent | null {
  if (!s) return null;
  const [action, type, ...rest] = s.split(":");
  const res = Intent.safeParse({ action, target: { type, id: rest.join(":") } });
  return res.success ? res.data : null;
}
