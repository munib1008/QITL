import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { EmptyState } from "@/components/ui/misc";
import { LanguagePrefsPanel } from "@/components/account/LanguagePrefsPanel";
import { getUser } from "@/lib/supabase/server";
import { journeyStops } from "@/content/journey";
import { MyQuestions } from "@/components/mufti/MyQuestions";
import { MyDreamRequests } from "@/components/dreams/MyDreamRequests";
import { ContinueReading } from "@/components/quran/ContinueReading";
import { SavedVerses } from "@/components/quran/SavedVerses";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { quranSource, surahList } from "@/content/quran";

export const metadata: Metadata = { title: "My library", robots: { index: false } };

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { sb, user } = await getUser();
  if (sb && !user) redirect("/sign-in?returnTo=/account");
  const surahNames = Object.fromEntries((surahList() ?? []).map((s) => [s.number, s.name]));
  return (
    <ReadingPage locale={locale} crumbs={[{ label: "My library" }]} title="My library" lead="Your bookmarks, reading progress and private notes, and your account settings. Only you can see this page.">
      <div className="zq-pagebody">
        {/* Three independent language choices; without an account they are kept on this device. */}
        <div id="language">
          <LanguagePrefsPanel locale={locale} />
        </div>
        {/* The Quran reading place: from this device, and from the account when signed in. */}
        <ContinueReading names={surahNames} locale={locale} more={4} />
        {sb && user ? (
          <>
            <SavedVerses names={surahNames} locale={locale} attribution={<QuranAttribution src={quranSource()} />} />
            <AccountDashboard email={user.email ?? ""} names={Object.fromEntries(journeyStops().map((s) => [s.id, s.name]))} />
            <MyQuestions locale={locale} />
            <MyDreamRequests locale={locale} compact />
          </>
        ) : (
          <EmptyState tone="soon" label={<span className="zq-soon">Coming soon</span>} title="Accounts are not open on this site yet.">
            <p>Everything is readable without an account.</p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
