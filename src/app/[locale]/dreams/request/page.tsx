import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { NotConfigured, SignInNeeded } from "@/components/mufti/states";
import { DreamRequestForm } from "@/components/dreams/DreamRequestForm";
import "@/styles/qa.css";
import { getUser } from "@/lib/supabase/server";
import { dreamsT } from "@/lib/i18n/modules/dreams";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const l = (await params).locale;
  return { title: dreamsT(l).form.title, robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function DreamRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = dreamsT(locale);
  const { sb, user } = await getUser();
  return (
    <ReadingPage locale={locale} crumbs={[{ href: "/dreams", label: t.crumbs.dreams }, { label: t.crumbs.request }]} title={t.form.title} lead={t.form.lead}>
      <div className="zq-pagebody qa">
        <div className="qa-support" role="note">
          <b>{t.guide.supportTitle}</b>
          <p>{t.guide.supportBody}</p>
        </div>
        {!sb ? (
          <NotConfigured locale={locale} title={t.mine.notConfigured} body={t.mine.notConfiguredBody} />
        ) : !user ? (
          <SignInNeeded title={t.form.signIn} link={t.form.signInLink} returnTo="/dreams/request" />
        ) : (
          <DreamRequestForm locale={locale} />
        )}
      </div>
    </ReadingPage>
  );
}
