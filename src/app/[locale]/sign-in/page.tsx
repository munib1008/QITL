import type { Metadata } from "next";
import { Suspense } from "react";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { SignInForm } from "@/components/account/SignInForm";
import { accountStrings } from "@/lib/i18n/modules/account";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: accountStrings((await params).locale).signIn, robots: { index: false } };
}

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = accountStrings(locale);
  return (
    <ReadingPage locale={locale} crumbs={[{ label: t.signIn }]} title={t.signIn} lead={t.signInLead}>
      <div className="zq-pagebody">
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </ReadingPage>
  );
}
