import { ShifaAdmin } from "@/components/admin/ShifaAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";
import { adminStrings } from "@/lib/i18n/modules/admin";
import { adminShifaStrings } from "@/lib/i18n/modules/adminShifa";

export default async function ShifaAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = adminShifaStrings(locale);
  const title = adminStrings(locale).nav["/admin/shifa"];
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{title}</h1>
      <p className="zq-meta">{t.pageLead}</p>
      <ShifaAdmin canEdit={admin || roles.includes("editor")} canReligious={admin || roles.includes("scholarly_reviewer")} canClinical={admin || roles.includes("science_reviewer")} />
    </div>
  );
}
