import { EditionRegistry } from "@/components/admin/interpretation";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";

export default async function EditionsPage() {
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Translation editions</h1>
      <p className="zq-meta">
        The registry of Quran translations, tafsir, early tafsir and hadith translations. Every edition is registered before anything is imported, and readers see its text only when it is verified and its source licence is cleared. Importers refuse any other edition.
      </p>
      <EditionRegistry canEdit={roles.includes("editor") || roles.includes("admin")} />
    </div>
  );
}
