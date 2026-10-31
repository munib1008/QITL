import { LicencesAdmin } from "@/components/admin/LicencesAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";

export default async function LicencesPage() {
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Content licences</h1>
      <p className="zq-meta">
        One row per source and asset type: APPROVED (an admin checked a licence or written permission), CONDITIONAL (usable under the recorded conditions), PERMISSION REQUIRED or BLOCKED.
        Nothing is approved because it is downloadable. Seeded rows were read on 2026-10-31 and wait for the owner&apos;s sign-off (docs/LICENSING.md).
      </p>
      <LicencesAdmin isAdmin={roles.includes("admin")} />
    </div>
  );
}
