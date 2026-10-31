import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { NotConfigured, SignInNeeded } from "@/components/mufti/states";
import { MyDreamRequests } from "@/components/dreams/MyDreamRequests";
import "@/styles/qa.css";
import { getUser } from "@/lib/supabase/server";
import { dreamsT } from "@/lib/i18n/modules/dreams";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const l = (await params).locale;
  return { title: dreamsT(l).mine.title, robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function MyDreamsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = dreamsT(locale);
  const { sb, user } = await getUser();
  return (
    <ReadingPage locale={locale} crumbs={[{ href: "/dreams", label: t.crumbs.dreams }, { label: t.crumbs.mine }]} title={t.mine.title} lead={t.mine.lead}>
      <div className="zq-pagebody qa">
        {!sb ? (
          <NotConfigured locale={locale} title={t.mine.notConfigured} body={t.mine.notConfiguredBody} />
        ) : !user ? (
          <SignInNeeded title={t.mine.signIn} link={t.form.signInLink} returnTo="/dreams/my" />
        ) : (
          <MyDreamRequests locale={locale} />
        )}
      </div>
    </ReadingPage>
  );
}
