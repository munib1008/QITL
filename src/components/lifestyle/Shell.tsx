import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/lifestyle.css";
import { ReadingPage, type Crumb } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { EditorialStatus } from "@/components/ui/evidence";
import { lifestyleStrings, type LifestyleStrings } from "@/lib/i18n/modules/lifestyle";
import type { Loaded } from "@/lib/lifestyle/data";

export const BASE = "/life-through-ages";
export type Section = "hub" | "food" | "day" | "compare" | "longevity" | "prophets";

const TABS: Array<[Exclude<Section, "prophets">, string]> = [
  ["hub", BASE],
  ["food", `${BASE}/food`],
  ["day", `${BASE}/day`],
  ["compare", `${BASE}/compare`],
  ["longevity", `${BASE}/longevity`],
];

/** The module shell: reading page, module tabs and the standing review notice. */
export function LtaShell({ locale, section, title, lead, crumbs, children }: { locale: string; section: Section; title: ReactNode; lead?: ReactNode; crumbs?: Crumb[]; children: ReactNode }) {
  const t = lifestyleStrings(locale);
  const label = (s: Exclude<Section, "prophets">) => (s === "hub" ? t.title : t.sections[s]);
  return (
    <ReadingPage
      locale={locale}
      crumbs={crumbs ?? (section === "hub" ? [{ label: t.title }] : [{ href: BASE, label: t.title }, { label: typeof title === "string" ? title : t.title }])}
      kicker={<EditorialStatus status="in_review">{t.draftNotice.split(".")[0]}</EditorialStatus>}
      title={title}
      lead={lead}
    >
      <div className="lta-body">
        <nav className="lta-tabs" aria-label={t.title}>
          {TABS.map(([s, href]) => (
            <Link key={s} href={href} aria-current={s === section ? "page" : undefined}>
              {label(s)}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </ReadingPage>
  );
}

/** The designed empty / unavailable state for a load result with no published records. */
export function NoRecords({ t, result, title }: { t: LifestyleStrings; result?: Loaded<unknown>; title?: string }) {
  if (result?.state === "error")
    return (
      <EmptyState title={t.loadError}>
        <p>{t.emptyBody}</p>
      </EmptyState>
    );
  return (
    <EmptyState title={title ?? t.emptyTitle}>
      <p>{t.emptyBody}</p>
      {result?.state === "not_configured" ? <p>{t.notConfigured}</p> : null}
    </EmptyState>
  );
}

export function okData<T>(r: Loaded<T[]>): T[] {
  return r.state === "ok" ? r.data : [];
}
