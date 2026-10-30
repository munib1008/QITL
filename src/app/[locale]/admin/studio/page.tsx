import { Studio } from "@/components/admin/studio/Studio";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";
import { getPlayerStrings } from "@/lib/i18n/modules/player";
import { laraConfigured } from "@/lib/production/lara";
import { getNarrationProvider } from "@/lib/production/narration";
import { draftConfigured } from "@/lib/production/draft";

/** Story Production Studio: scripts in eight scenes, claims, review, translation and narration requests, preview. */
export default async function StudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const s = getPlayerStrings(locale).studio;
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");
  const has = (r: (typeof roles)[number]) => admin || roles.includes(r);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{s.title}</h1>
      <Studio
        locale={locale}
        flags={{ translate: laraConfigured(), narrate: Boolean(getNarrationProvider()), draft: draftConfigured() }}
        roles={{ editor: has("editor"), reviewer: has("scholarly_reviewer"), translator: has("translation_reviewer"), audio: has("audio_producer") }}
      />
    </div>
  );
}
