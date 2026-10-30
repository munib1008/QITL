import { TranslationReviewDesk } from "@/components/admin/studio/TranslationReview";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";
import { getPlayerStrings } from "@/lib/i18n/modules/player";

export default async function TranslationReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const s = getPlayerStrings(locale).studio;
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{s.translations}</h1>
      <TranslationReviewDesk locale={locale} canLinguistic={admin || roles.includes("translation_reviewer")} canReligious={admin || roles.includes("scholarly_reviewer")} />
    </div>
  );
}
