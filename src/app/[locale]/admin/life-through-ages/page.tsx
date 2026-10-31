import { LifestyleAdmin } from "@/components/admin/LifestyleAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";
import { adminStrings } from "@/lib/i18n/modules/admin";

export default async function LifestyleAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const a = adminStrings((await params).locale).pages["life-through-ages"]!;
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{a.title}</h1>
      <p className="zq-meta">{a.lead}</p>
      <LifestyleAdmin canEdit={admin || roles.includes("editor")} canReligious={admin || roles.includes("scholarly_reviewer")} canScience={admin || roles.includes("science_reviewer")} />
    </div>
  );
}
