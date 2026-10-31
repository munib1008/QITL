import Link from "next/link";
import type { ReactNode } from "react";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { ReadingHeader, SiteFooter } from "./SiteHeader";

export interface Crumb {
  href?: string;
  label: string;
}

/** Solid light/dark reading shell: header, breadcrumb, optional page head, main, footer. */
export function ReadingPage({
  locale,
  crumbs,
  title,
  kicker,
  lead,
  meta,
  query,
  children,
}: {
  locale: string;
  crumbs?: Crumb[];
  title?: ReactNode;
  kicker?: ReactNode;
  lead?: ReactNode;
  meta?: ReactNode;
  query?: string;
  children: ReactNode;
}) {
  const u = uiStrings(locale).shell;
  return (
    <div className="pp">
      <ReadingHeader locale={locale} query={query} />
      <main className="pp-wrap" id="main">
        {crumbs?.length ? (
          <ol className="pp-crumb" aria-label={u.breadcrumb}>
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
          <header className="zq-pagehead">
            {kicker ? <div className="pp-kick">{kicker}</div> : null}
            <h1>{title}</h1>
            {lead ? <p className="lead">{lead}</p> : null}
            {meta ? <div className="pp-meta" style={{ marginTop: 14 }}>{meta}</div> : null}
          </header>
        ) : null}
        {children}
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
