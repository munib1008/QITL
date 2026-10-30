import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { z, ZodTypeAny } from "zod";
import { publicEnv } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";

export type ApiError = { error: string; code: string; issues?: unknown };

export function json<T>(data: T, init?: number | ResponseInit) {
  const res = NextResponse.json(data, typeof init === "number" ? { status: init } : init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function fail(status: number, code: string, error: string, issues?: unknown) {
  return json<ApiError>({ error, code, ...(issues ? { issues } : {}) }, status);
}

export const notConfigured = () =>
  fail(503, "not_configured", "This feature needs the database, which is not configured on this deployment yet.");

/** Public cached JSON for read-only endpoints over published data. */
export function publicJson<T>(data: T, maxAge = 300) {
  const res = NextResponse.json(data);
  res.headers.set("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}`);
  return res;
}

/** CSRF defence for cookie-authenticated mutations: the Origin (or Referer) must be this site. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const allowed = new Set([new URL(publicEnv.siteUrl).host, req.nextUrl.host]);
    return allowed.has(o.host);
  } catch {
    return false;
  }
}

type Authed = { sb: SupabaseClient; user: User };

/**
 * Resolve the signed-in user for a mutation: 503 when not configured, 403 on a cross-site request,
 * 401 when signed out. Authorization beyond "signed in" is enforced by RLS in the database.
 */
export async function requireUser(req: NextRequest, { mutation = true } = {}): Promise<Authed | NextResponse> {
  if (mutation && !sameOrigin(req)) return fail(403, "bad_origin", "Cross-site request refused.");
  const { sb, user } = await getUser();
  if (!sb) return notConfigured();
  if (!user) return fail(401, "unauthorized", "Sign in to do this.");
  return { sb, user };
}

export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.output<S> | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "bad_json", "The request body must be JSON.");
  }
  const r = schema.safeParse(raw);
  if (!r.success) return fail(422, "invalid", "The request is not valid.", r.error.flatten());
  return r.data;
}

export function parseQuery<S extends ZodTypeAny>(req: NextRequest, schema: S): z.output<S> | NextResponse {
  const r = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!r.success) return fail(422, "invalid", "The query is not valid.", r.error.flatten());
  return r.data;
}

/** Map database errors to HTTP without leaking internals. Never logs request bodies (private notes). */
export function dbError(e: { code?: string; message?: string } | null | undefined) {
  const code = e?.code ?? "";
  const msg = e?.message ?? "";
  if (code === "P0429" || msg.startsWith("rate_limited")) return fail(429, "rate_limited", "Too many requests. Try again in a minute.");
  if (code === "42501" || /row-level security|permission denied/.test(msg)) return fail(403, "forbidden", "You do not have permission to do this.");
  if (code === "23505") return fail(409, "duplicate", "That already exists.");
  if (code === "23503") return fail(422, "missing_reference", "Something this refers to does not exist.");
  if (code === "23514") return fail(422, "constraint", "That would break a data rule.");
  if (code === "P0001") return fail(422, "rule", msg.replace(/^.*?: /, "") || "That would break an editorial rule.");
  if (code === "PGRST116") return fail(404, "not_found", "Not found.");
  console.error("[api] database error", code);
  return fail(500, "server_error", "Something went wrong on our side.");
}

export const isResponse = (x: unknown): x is NextResponse => x instanceof NextResponse;
