import Link from "next/link";
import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { AdminNav } from "@/components/admin/AdminNav";
import { EmptyState } from "@/components/ui/misc";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";

export const metadata: Metadata = { title: "Editorial", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The editor shell. Staff only; every action is authorised again by the API route and by RLS in the database.
 * Signed-out and non-staff visitors see why they cannot enter, never the tools.
 */
export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  return (
    <ReadingPage locale={locale} crumbs={[{ label: "Editorial" }]}>
      {!sb ? (
        <div className="zq-pagebody">
          <EmptyState tone="soon" label={<span className="zq-soon">Not configured</span>} title="The editorial tools need the database.">
            <p>Connect Supabase (see the README) to use the editor, review and moderation tools.</p>
          </EmptyState>
        </div>
      ) : !user ? (
        <div className="zq-pagebody">
          <EmptyState title="Sign in to use the editorial tools.">
            <p>
              <Link href="/sign-in?returnTo=/admin">Sign in</Link>. Access needs an editor, reviewer, moderator or admin role.
            </p>
          </EmptyState>
        </div>
      ) : !roles.length ? (
        <div className="zq-pagebody">
          <EmptyState title="You do not have an editorial role.">
            <p>Roles are granted by an administrator after verifying identity and, for scholarly reviewers, credentials.</p>
          </EmptyState>
        </div>
      ) : (
        <div className="zq-admin">
          <AdminNav roles={roles} />
          <div>{children}</div>
        </div>
      )}
    </ReadingPage>
  );
}
