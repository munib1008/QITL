import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { fontVariables } from "../fonts";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { publicEnv } from "@/lib/env";
import { ServiceWorker } from "@/components/shell/ServiceWorker";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: "QITL — Quran in Timeline", template: "%s · QITL" },
  applicationName: "QITL",
  description:
    "Explore the story. Follow the evidence. The Quran, authenticated Hadith, the prophets, chronology and geography — every claim labelled by how certain it is.",
  openGraph: { type: "website", siteName: "QITL — Quran in Timeline" },
  twitter: { card: "summary_large_image" },
  alternates: { languages: { en: "/", ar: "/ar" } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ea" },
    { media: "(prefers-color-scheme: dark)", color: "#061519" },
  ],
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * Applies a theme the reader chose earlier before first paint (no flash). Without a choice the CSS follows
 * prefers-color-scheme. Pages that own a theme (the home journey) set data-theme on their own wrapper.
 */
const THEME_INIT = `try{var t=localStorage.getItem("qitl-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { dir, t } = getDict(locale);
  return (
    <html lang={locale} dir={dir} className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <a className="zq-skip" href="#main">
          {t.skip}
        </a>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
