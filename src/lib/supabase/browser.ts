"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, supabaseConfigured } from "@/lib/env";

let client: SupabaseClient | null | undefined;
export function getBrowserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = supabaseConfigured() ? createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey) : null;
  return client;
}
