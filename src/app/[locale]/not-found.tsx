"use client";

import Link from "next/link";
import { ReadingHeader, SiteFooter } from "@/components/shell/SiteHeader";
import { Rosette } from "@/components/ui/icons";
import { SearchField } from "@/components/ui/misc";
import { getDict } from "@/lib/i18n";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";

/** 404 in the interface language (not-found gets no params, so the locale comes from the route segment). */
export default function NotFound() {
  const locale = useLocale();
  const u = uiStrings(locale);
  const { t } = getDict(locale);
  return (
    <div className="pp">
      <ReadingHeader locale={locale} />
      <main className="pp-wrap" id="main">
        <div className="zq-status-page">
          <Rosette points={8} className="pp-mark" />
          <p className="zq-eyebrow">404</p>
          <h1>{u.errors.notFoundTitle}</h1>
          <p className="zq-meta">{u.errors.notFoundBody}</p>
          <SearchField id="nf-q" maxWidth={480} />
          <p>
            <Link href="/">{u.shell.home}</Link> · <Link href="/prophets">{t.nav.prophets}</Link> · <Link href="/quran">{t.nav.quran}</Link>
          </p>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
