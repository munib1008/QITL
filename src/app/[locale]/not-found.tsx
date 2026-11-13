"use client";

import Link from "next/link";
import { HudHeader, SiteFooter } from "@/components/shell/SiteHeader";
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
      <HudHeader locale={locale} />
      <main className="pp-main" id="main">
        <section className="qs container nf">
          <Rosette points={8} className="mark" />
          <div className="eyebrow">404</div>
          <h1>{u.errors.notFoundTitle}</h1>
          <p>{u.errors.notFoundBody}</p>
          <SearchField id="nf-q" maxWidth={480} />
          <div className="cta" style={{ marginTop: "var(--space-5)", display: "flex", flexWrap: "wrap", gap: "var(--space-3)", justifyContent: "center" }}>
            <Link className="btn gold" href="/">
              {u.shell.home}
            </Link>
            <Link className="btn" href="/prophets">
              {t.nav.prophets}
            </Link>
            <Link className="btn" href="/quran">
              {t.nav.quran}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
