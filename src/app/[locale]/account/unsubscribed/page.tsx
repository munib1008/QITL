import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { accountStrings } from "@/lib/i18n/modules/account";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: accountStrings((await params).locale).unsubscribed, robots: { index: false } };
}

export default async function Unsubscribed({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { locale } = await params;
  const ok = (await searchParams).ok === "1";
  const t = accountStrings(locale);
  return (
    <ReadingPage
      locale={locale}
      title={ok ? t.unsubscribedTitle : t.badLinkTitle}
      lead={ok ? t.unsubscribedBody : t.badLinkBody}
    >
      <div className="zq-pagebody" />
    </ReadingPage>
  );
}
