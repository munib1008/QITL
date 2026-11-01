import Link from "next/link";
import type { Metadata } from "next";
import { UniverseAdmin } from "@/components/admin/UniverseAdmin";
import { rolesOf } from "@/lib/admin";
import { getUser } from "@/lib/supabase/server";
import { adminStrings } from "@/lib/i18n/modules/admin";
import { adminUniverseStrings } from "@/lib/i18n/modules/adminUniverse";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: adminStrings((await params).locale).nav["/admin/events/universe"] };
}

export default async function UniverseAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = adminUniverseStrings(locale);
  const title = adminStrings(locale).nav["/admin/events/universe"];
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{title}</h1>
      <p className="zq-meta">
        {t.pageLeadA} <Link href="/admin/events/coverage">{t.pageLeadLink}</Link> {t.pageLeadB}
      </p>
      <UniverseAdmin canEdit={admin || roles.includes("editor")} canDate={admin || roles.includes("science_reviewer")} />
    </div>
  );
}
