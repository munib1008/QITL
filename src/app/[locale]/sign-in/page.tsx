import type { Metadata } from "next";
import { Suspense } from "react";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { SignInForm } from "@/components/account/SignInForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: "Sign in" }]}
      title="Sign in"
      lead="Reading never needs an account. Sign in only to keep bookmarks, private notes and reading progress, or to join a discussion."
    >
      <div className="zq-pagebody">
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </ReadingPage>
  );
}
