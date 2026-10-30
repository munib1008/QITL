import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { getServiceSupabase } from "@/lib/supabase/server";

const Confirm = z.object({ confirm: z.literal("DELETE MY ACCOUNT") });

/**
 * Permanently delete the signed-in account. The user types the confirmation phrase; the server deletes the auth
 * user with the service role, and foreign keys cascade to profile, bookmarks, progress, notes, follows,
 * notifications and comments. Moderation logs keep only ids.
 */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const c = await parseBody(req, Confirm);
  if (isResponse(c)) return c;
  const admin = getServiceSupabase();
  if (!admin) return fail(503, "not_configured", "Account deletion needs the server key, which is not configured. Contact us to delete your account.");
  const { error } = await admin.auth.admin.deleteUser(a.user.id);
  if (error) {
    console.error("[api] account deletion failed");
    return fail(500, "server_error", "Deletion failed. Nothing was deleted; try again or contact us.");
  }
  await a.sb.auth.signOut();
  return json({ deleted: true });
}
