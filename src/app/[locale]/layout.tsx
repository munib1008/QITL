import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { fontVariables } from "../fonts";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { publicEnv } from "@/lib/env";
import { ServiceWorker } from "@/components/shell/ServiceWorker";
import { BottomNav } from "@/components/shell/BottomNav";
import { exploreLinks } from "@/lib/nav";
import { Analytics } from "@/components/shell/Analytics";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: "QITL — Quran in Timeline", template: "%s · QITL" },
  applicationName: "QITL",
  description:
    "Explore the story. Follow the evidence. The Quran, authenticated Hadith, the prophets, chronology and geography — every claim labelled by how certain it is.",
  openGraph: { type: "website", siteName: "QITL — Quran in Timeline" },
  twitter: { card: "summary_large_image" },
  alternates: { languages: { en: "/", ar: "/ar", ur: "/ur" } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // safe-area insets for the bottom navigation on notched phones
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
  // The per-request CSP nonce from the middleware (src/middleware.ts). Reading it makes every page render per request:
  // a nonce-based policy cannot be served from a prebuilt HTML file (docs/SECURITY.md, "CSP").
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang={locale} dir={dir} className={fontVariables} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <a className="zq-skip" href="#main">
          {t.skip}
        </a>
        {children}
        <BottomNav
          locale={locale}
          langLabels={t.lang}
          labels={t.bottom}
          explore={exploreLinks(locale).filter((l) => l.href !== "/quran")}
        />
        <ServiceWorker />
        <Analytics />
      </body>
    </html>
  );
}
