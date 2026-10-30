import { LifestyleAdmin } from "@/components/admin/LifestyleAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";

export default async function LifestyleAdminPage() {
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Life Through the Ages</h1>
      <p className="zq-meta">
        Draft research records and their two review pathways: religious (scholarly reviewers, classes A and B) and historical/scientific (science reviewers, classes C and D).
        Publishing is refused by the database until the evidence and every required review are in place.
      </p>
      <LifestyleAdmin canEdit={admin || roles.includes("editor")} canReligious={admin || roles.includes("scholarly_reviewer")} canScience={admin || roles.includes("science_reviewer")} />
    </div>
  );
}
