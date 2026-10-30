import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { EmptyState } from "@/components/ui/misc";
import { getUser } from "@/lib/supabase/server";
import { journeyStops } from "@/content/journey";

export const metadata: Metadata = { title: "My library", robots: { index: false } };

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { sb, user } = await getUser();
  if (sb && !user) redirect("/sign-in?returnTo=/account");
  return (
    <ReadingPage locale={locale} crumbs={[{ label: "My library" }]} title="My library" lead="Your bookmarks, reading progress, private notes and followed discussions. Only you can see this page.">
      <div className="zq-pagebody">
        {sb && user ? (
          <AccountDashboard email={user.email ?? ""} names={Object.fromEntries(journeyStops().map((s) => [s.id, s.name]))} />
        ) : (
          <EmptyState tone="soon" label={<span className="zq-soon">Coming soon</span>} title="Accounts are not open on this site yet.">
            <p>Everything is readable without an account.</p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
