import { ShifaAdmin } from "@/components/admin/ShifaAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";

export default async function ShifaAdminPage() {
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Shifa (شفاء)</h1>
      <p className="zq-meta">
        Draft records and their two review pathways: religious (scholarly reviewers: Quran, hadith, scholarly notes, supplications, ruqyah) and clinical
        (science reviewers: research, traditional use and every health statement, and safety notes). Publishing is refused by the database until the
        evidence, the safety notes and every required review of the current version are in place.
      </p>
      <ShifaAdmin canEdit={admin || roles.includes("editor")} canReligious={admin || roles.includes("scholarly_reviewer")} canClinical={admin || roles.includes("science_reviewer")} />
    </div>
  );
}
