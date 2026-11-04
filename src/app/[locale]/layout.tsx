import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { fontVariables } from "../fonts";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { publicEnv } from "@/lib/env";
import { ServiceWorker } from "@/components/shell/ServiceWorker";
import { BottomNav } from "@/components/shell/BottomNav";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { exploreLinks } from "@/lib/nav";
import { applyNav } from "@/lib/site-config/config";
import { getSiteConfig } from "@/lib/site-config/server";
import { Analytics } from "@/components/shell/Analytics";
import "../globals.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const site = uiStrings(locale).site;
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: site.title, template: "%s · QITL" },
    applicationName: "QITL",
    description: site.description,
    openGraph: { type: "website", siteName: site.title },
    twitter: { card: "summary_large_image" },
    alternates: { languages: { en: "/", ar: "/ar", ur: "/ur" } },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // safe-area insets for the bottom navigation on notched phones
  themeColor: "#eff2f9",
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { dir, t } = getDict(locale);
  // The per-request CSP nonce from the middleware (src/middleware.ts). Reading it makes every page render per request:
  // a nonce-based policy cannot be served from a prebuilt HTML file (docs/SECURITY.md, "CSP").
  await headers();
  // Hidden sections and the Explore order set in /admin/site; the built-in list when nothing is configured.
  const siteConfig = await getSiteConfig();
  return (
    <html lang={locale} dir={dir} className={fontVariables} data-theme="light" suppressHydrationWarning>
      <body>
        <a className="zq-skip" href="#main">
          {t.skip}
        </a>
        {children}
        <BottomNav
          locale={locale}
          langLabels={t.lang}
          labels={t.bottom}
          explore={applyNav(exploreLinks(locale).filter((l) => l.href !== "/quran"), siteConfig)}
        />
        <ServiceWorker />
        <Analytics />
      </body>
    </html>
  );
}
