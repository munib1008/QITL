import { LicencesAdmin } from "@/components/admin/LicencesAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";
import { adminStrings } from "@/lib/i18n/modules/admin";

export default async function LicencesPage({ params }: { params: Promise<{ locale: string }> }) {
  const a = adminStrings((await params).locale).pages["licences"]!;
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{a.title}</h1>
      <p className="zq-meta">{a.lead}</p>
      <LicencesAdmin isAdmin={roles.includes("admin")} />
    </div>
  );
}
