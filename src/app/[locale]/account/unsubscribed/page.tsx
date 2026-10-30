import { ReadingPage } from "@/components/shell/ReadingPage";

export const metadata = { title: "Unsubscribed", robots: { index: false } };

export default async function Unsubscribed({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { locale } = await params;
  const ok = (await searchParams).ok === "1";
  return (
    <ReadingPage
      locale={locale}
      title={ok ? "You are unsubscribed" : "That link did not work"}
      lead={ok ? "You will not receive digest or reply emails. You can turn them back on from My library." : "The unsubscribe link is invalid or has already been used. Sign in and change notifications from My library."}
    >
      <div className="zq-pagebody" />
    </ReadingPage>
  );
}
