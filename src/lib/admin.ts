import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { fail, isResponse, requireUser } from "@/lib/api";

export type Role = "moderator" | "editor" | "scholarly_reviewer" | "translation_reviewer" | "admin";

/**
 * Staff gate for admin routes: signed in, same-origin, and holding the role. The database enforces the same
 * rules again through RLS and triggers, so this check is defence in depth, not the only lock.
 */
export async function requireRole(req: NextRequest, role: Role, opts?: { mutation?: boolean }): Promise<{ sb: SupabaseClient; user: User } | NextResponse> {
  const a = await requireUser(req, opts);
  if (isResponse(a)) return a;
  const { data, error } = await a.sb.rpc("has_role", { r: role });
  if (error || data !== true) return fail(403, "forbidden", `This needs the ${role.replace("_", " ")} role.`);
  return a;
}

export async function rolesOf(sb: SupabaseClient, userId: string): Promise<Role[]> {
  const { data } = await sb.from("role_assignments").select("role").eq("user_id", userId);
  return (data ?? []).map((r: { role: Role }) => r.role);
}
