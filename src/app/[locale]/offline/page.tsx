import type { Metadata } from "next";
import Link from "next/link";
import { uiStrings } from "@/lib/i18n/modules/ui";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: uiStrings(locale).errors.offline, robots: { index: false } };
}

/** Shown when the network is unavailable (the service worker serves this page as its fallback). */
export default async function Offline({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = uiStrings(locale).errors;
  return (
    <main className="pp-wrap" id="main">
      <div className="zq-status-page">
        <p className="zq-eyebrow">{t.offline}</p>
        <h1>{t.offlineTitle}</h1>
        <p className="zq-meta">{t.offlineBody}</p>
        <p>
          <Link href="/">{t.retry}</Link>
        </p>
      </div>
    </main>
  );
}
