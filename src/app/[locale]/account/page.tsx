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
import { accountStrings } from "@/lib/i18n/modules/account";
import { ContinueReading } from "@/components/quran/ContinueReading";
import { SavedVerses } from "@/components/quran/SavedVerses";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { quranSource, surahList } from "@/content/quran";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: accountStrings((await params).locale).library, robots: { index: false } };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { sb, user } = await getUser();
  if (sb && !user) redirect("/sign-in?returnTo=/account");
  const t = accountStrings(locale);
  const surahNames = Object.fromEntries((surahList() ?? []).map((s) => [s.number, s.name]));
  return (
    <ReadingPage locale={locale} crumbs={[{ label: t.library }]} title={t.library} lead={t.libraryLead}>
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
          <EmptyState tone="soon" label={<span className="zq-soon">{t.soon}</span>} title={t.notOpen}>
            <p>{t.readable}</p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
