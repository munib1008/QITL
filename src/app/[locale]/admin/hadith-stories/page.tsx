import { HadithStoriesAdmin } from "@/components/admin/HadithStoriesAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";
import { adminStrings } from "@/lib/i18n/modules/admin";
import { adminHadithStoriesStrings } from "@/lib/i18n/modules/adminHadithStories";

export default async function HadithStoriesAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = adminHadithStoriesStrings(locale);
  const title = adminStrings(locale).nav["/admin/hadith-stories"];
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{title}</h1>
      <p className="zq-meta">{t.pageTitleLead}</p>
      <HadithStoriesAdmin canEdit={admin || roles.includes("editor")} canReview={admin || roles.includes("scholarly_reviewer")} />
    </div>
  );
}
