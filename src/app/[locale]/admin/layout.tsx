import Link from "next/link";
import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { AdminNav } from "@/components/admin/AdminNav";
import { EmptyState } from "@/components/ui/misc";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";
import { adminStrings } from "@/lib/i18n/modules/admin";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: adminStrings((await params).locale).editorial, robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

/**
 * The editor shell. Staff only; every action is authorised again by the API route and by RLS in the database.
 * Signed-out and non-staff visitors see why they cannot enter, never the tools.
 */
export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const a = adminStrings(locale);
  return (
    <ReadingPage locale={locale} crumbs={[{ label: a.editorial }]}>
      {!sb ? (
        <div className="zq-pagebody">
          <EmptyState tone="soon" label={<span className="zq-soon">{a.notConfigured}</span>} title={a.needsDb}>
            <p>{a.needsDbBody}</p>
          </EmptyState>
        </div>
      ) : !user ? (
        <div className="zq-pagebody">
          <EmptyState title={a.signInTitle}>
            <p>
              <Link href="/sign-in?returnTo=/admin">{a.signIn}</Link>
              {a.signInBody}
            </p>
          </EmptyState>
        </div>
      ) : !roles.length ? (
        <div className="zq-pagebody">
          <EmptyState title={a.noRole}>
            <p>{a.noRoleBody}</p>
          </EmptyState>
        </div>
      ) : (
        <div className="zq-admin">
          <AdminNav roles={roles} labels={{ menu: a.menu, editorial: a.editorial, nav: a.nav, roles: a.roles }} />
          <div>{children}</div>
        </div>
      )}
    </ReadingPage>
  );
}
