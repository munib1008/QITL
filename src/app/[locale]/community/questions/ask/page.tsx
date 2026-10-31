import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { NotConfigured, SignInNeeded } from "@/components/mufti/states";
import { AskForm } from "@/components/mufti/AskForm";
import { getUser } from "@/lib/supabase/server";
import { muftiT } from "@/lib/i18n/modules/mufti";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const l = (await params).locale;
  return { title: muftiT(l).ask.title, robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function AskPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = muftiT(locale);
  const { sb, user } = await getUser();
  return (
    <ReadingPage
      locale={locale}
      crumbs={[
        { href: "/community", label: t.crumbs.community },
        { href: "/community/questions", label: t.crumbs.questions },
        { label: t.crumbs.ask },
      ]}
      title={t.ask.title}
      lead={t.ask.lead}
    >
      <div className="zq-pagebody qa">
        {!sb ? (
          <NotConfigured locale={locale} title={t.list.notConfigured} body={t.list.notConfiguredBody} />
        ) : !user ? (
          <SignInNeeded title={t.ask.signIn} link={t.ask.signInLink} returnTo="/community/questions/ask" />
        ) : (
          <AskForm locale={locale} />
        )}
      </div>
    </ReadingPage>
  );
}
