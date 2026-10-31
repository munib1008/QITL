import Link from "next/link";
import { UniverseAdmin } from "@/components/admin/UniverseAdmin";
import { rolesOf } from "@/lib/admin";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Event Universe" };

export default async function UniverseAdminPage() {
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Event Universe</h1>
      <p className="zq-meta">
        The inventory behind the Complete Timeline: every identified Quranic narrative event, person and community. Items are drafts, checked against the Quran text, and are never public until approved. See the{" "}
        <Link href="/admin/events/coverage">research coverage</Link> for what is covered and what is still to research.
      </p>
      <UniverseAdmin canEdit={admin || roles.includes("editor")} canDate={admin || roles.includes("science_reviewer")} />
    </div>
  );
}
