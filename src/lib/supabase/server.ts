import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, supabaseConfigured } from "@/lib/env";

/** Request-scoped client acting as the signed-in user (RLS applies). Null when Supabase is not configured. */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured()) return null;
  const store = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the middleware refreshes the session instead.
        }
      },
    },
  });
}

/** The signed-in user, verified with the Auth server (never trusted from the cookie alone). */
export async function getUser() {
  const sb = await getServerSupabase();
  if (!sb) return { sb: null, user: null } as const;
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user } as const;
}

/**
 * Service-role client for trusted server jobs only (ingestion, export/deletion jobs).
 * Bypasses RLS: never call it from a request path that acts on user input without its own authorization check.
 */
export function getServiceSupabase(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseConfigured() || !key) return null;
  return createClient(publicEnv.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Anonymous, cookie-free client for public reads of published content. RLS limits it to what any visitor may see,
 * and because it never touches cookies, pages that use it stay statically cacheable (ISR).
 */
let publicClient: SupabaseClient | null | undefined;
export function getPublicSupabase(): SupabaseClient | null {
  if (publicClient !== undefined) return publicClient;
  publicClient = supabaseConfigured()
    ? createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return publicClient;
}
