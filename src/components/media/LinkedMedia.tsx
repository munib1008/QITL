import { getPublicSupabase } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n/dict";
import { MediaImage } from "./MediaImage";

/**
 * Library items (images, GIFs, clips) an editor attached to a story, person or event. Only PUBLISHED, licensed items
 * render (MediaImage reads media_public); an attached item that is still a draft shows nothing, never a placeholder.
 */
export async function LinkedMedia({ type, id, locale }: { type: "story" | "person" | "event"; id: string; locale: Locale }) {
  const sb = getPublicSupabase();
  if (!sb || !/^[a-z0-9-]{2,80}$/.test(id)) return null;
  const { data } = await sb.from("asset_links").select("asset_id, position").eq("entity_type", type).eq("entity_id", id).order("position").limit(12);
  const ids = ((data ?? []) as { asset_id: string }[]).map((r) => r.asset_id);
  if (!ids.length) return null;
  return (
    <section className="pp-sec" aria-label="Media" data-testid="linked-media" style={{ display: "grid", gap: 16 }}>
      {ids.map((a) => (
        <MediaImage key={a} assetId={a} locale={locale} sizes="(max-width: 760px) 100vw, 720px" />
      ))}
    </section>
  );
}
