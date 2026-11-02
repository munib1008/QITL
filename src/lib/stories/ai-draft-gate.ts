import { getPublicSupabase } from "@/lib/supabase/server";

/**
 * Which story drafts the DATABASE has released as public AI drafts (visibility public_ai_draft AND a passed source-integrity
 * check, via public_ai_drafts()). null means no database is configured (the file index is shown, as in the offline build and
 * the e2e suite). When a database IS configured the gate fails closed: an error means no draft is public.
 */
export async function publicAiDraftGate(): Promise<Map<string, { scholarly_status: string }> | null> {
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("public_ai_drafts");
  if (error || !Array.isArray(data)) return new Map();
  return new Map((data as { slug: string; scholarly_status: string }[]).map((d) => [d.slug, { scholarly_status: d.scholarly_status }]));
}
