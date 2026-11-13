import Link from "next/link";
import type { ReactNode } from "react";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { HudHeader, SiteFooter } from "./SiteHeader";
import { getSiteConfig } from "@/lib/site-config/server";

export interface Crumb {
  href?: string;
  label: string;
}

/** Solid light/dark reading shell: header, breadcrumb, optional page head, main, footer. */
export async function ReadingPage({
  locale,
  crumbs,
  title,
  kicker,
  lead,
  meta,
  children,
}: {
  locale: string;
  crumbs?: Crumb[];
  title?: ReactNode;
  kicker?: ReactNode;
  lead?: ReactNode;
  meta?: ReactNode;
  /** Kept for callers that pass the search text; the header's search is the command palette now. */
  query?: string;
  children: ReactNode;
}) {
  const u = uiStrings(locale).shell;
  const config = await getSiteConfig(); // hidden sections and the Explore order from /admin/site
  return (
    <div className="pp">
      <HudHeader locale={locale} config={config} />
      <main className="pp-main" id="main">
        <div className="qs">
          <section className="phero container">
            {crumbs?.length ? (
              <ol className="crumb" aria-label={u.breadcrumb}>
                <li>
                  <Link href="/">{u.home}</Link>
                </li>
                {crumbs.map((c, i) => (
                  <li key={c.label} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                    {c.href && i < crumbs.length - 1 ? <Link href={c.href}>{c.label}</Link> : c.label}
                  </li>
                ))}
              </ol>
            ) : null}
            {title ? (
              <>
                {kicker ? <div className="eyebrow">{kicker}</div> : null}
                <h1>{title}</h1>
                {lead ? <p className="lead">{lead}</p> : null}
                {meta ? <div className="meta">{meta}</div> : null}
              </>
            ) : null}
          </section>
        </div>
        <div className="container reading-body">{children}</div>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
