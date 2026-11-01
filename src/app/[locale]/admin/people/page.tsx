import Link from "next/link";
import { PeopleAdmin } from "@/components/admin/PeopleAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";
import { peopleAdminStrings } from "@/lib/i18n/modules/peopleAdmin";

export default async function PeopleAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = peopleAdminStrings(locale);
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{t.people.title}</h1>
      <p className="zq-meta">{t.people.lead}</p>
      <p style={{ margin: 0 }}>
        <Link href="/admin/communities">{t.switchTo.communities}</Link>
      </p>
      <PeopleAdmin scope="person" canEdit={admin || roles.includes("editor")} canReview={admin || roles.includes("scholarly_reviewer")} t={t} />
    </div>
  );
}
