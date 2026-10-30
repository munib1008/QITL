import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import { AMBIENCE_SELECT, AUDIO_BUCKET, SCRIPT_SELECT, audioPaths, mapAmbience, mapScript, type AmbienceRow, type ScriptRow } from "@/lib/player/map";
import type { PlayerBundle } from "@/lib/player/types";

/** Signed URLs outlive the page's revalidation window (300 s) many times over. */
const URL_TTL_S = 6 * 3600;

/**
 * The published story scripts for a person or an event (every language and audience), with their approved narration
 * and approved ambience. Null when there is no published script or the database is not configured: the page then
 * shows nothing new.
 */
export async function getPlayerBundle(subject: { person?: string; event?: string }): Promise<PlayerBundle | null> {
  const sb = getPublicSupabase();
  if (!sb) return null;
  try {
    const slug = subject.person ?? subject.event;
    if (!slug) return null;
    const table = subject.person ? "people" : "historical_events";
    const { data: subj } = await sb.from(table).select("id").eq("slug", slug).eq("status", "published").maybeSingle();
    if (!subj) return null;
    const { data, error } = await sb
      .from("story_scripts")
      .select(SCRIPT_SELECT)
      .eq(subject.person ? "person_id" : "event_id", (subj as { id: string }).id)
      .eq("status", "published")
      .order("created_at");
    if (error || !data?.length) return null;
    const rows = data as unknown as ScriptRow[];
    const keys = [...new Set(rows.flatMap((r) => (r.story_scenes ?? []).map((s) => s.ambient_key).filter((k): k is string => Boolean(k))))];
    const amb = keys.length ? await sb.from("scene_ambient_audio").select(AMBIENCE_SELECT).in("key", keys) : { data: [] };
    const ambRows = (amb.data ?? []) as AmbienceRow[];
    const paths = [...audioPaths(rows), ...ambRows.map((a) => a.storage_path)];
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await sb.storage.from(AUDIO_BUCKET).createSignedUrls(paths, URL_TTL_S);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }
    const url = (p: string) => urls.get(p) ?? null;
    return { scripts: rows.map((r) => mapScript(r, url)).filter((s) => s.scenes.length > 0), ambience: mapAmbience(ambRows, url) };
  } catch {
    return null;
  }
}
