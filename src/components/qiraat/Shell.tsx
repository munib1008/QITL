import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/qiraat.css";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EditorialStatus } from "@/components/ui/evidence";
import { qiraatStrings } from "@/lib/i18n/modules/qiraat";

export const BASE = "/qiraat";
export type Section = "hub" | "compare";

/** The module shell: reading page, module tabs and the standing draft notice. */
export function QiraatShell({ locale, section, title, lead, children }: { locale: string; section: Section; title: string; lead?: ReactNode; children: ReactNode }) {
  const t = qiraatStrings(locale);
  const tabs: Array<[Section, string, string]> = [
    ["hub", BASE, t.tabs.hub],
    ["compare", `${BASE}/compare`, t.tabs.compare],
  ];
  return (
    <ReadingPage
      locale={locale}
      crumbs={section === "hub" ? [{ label: t.title }] : [{ href: BASE, label: t.title }, { label: title }]}
      kicker={<EditorialStatus status="in_review">{t.draft}</EditorialStatus>}
      title={title}
      lead={lead}
    >
      <div className="qr-body">
        <nav className="qr-tabs" aria-label={t.nav}>
          {tabs.map(([s, href, label]) => (
            <Link key={s} href={href} aria-current={s === section ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </ReadingPage>
  );
}
