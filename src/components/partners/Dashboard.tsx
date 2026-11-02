"use client";

import Link from "next/link";
import { partnersT } from "@/lib/i18n/modules/partners";
import { Skeleton } from "@/components/ui/misc";
import { AvailabilityPanel, DocumentsPanel, InquiriesPanel, OverviewPanel, PricingPanel, ProfilePanel, ServicesPanel, SettingsPanel } from "./DashboardPanels";
import type { CategoryOption } from "./RegisterWizard";
import { useDashData } from "./useDashData";

export const DASHBOARD_TABS = ["overview", "profile", "services", "pricing", "availability", "inquiries", "documents", "settings"] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export interface MyListing {
  id: string;
  slug: string;
  display_name: string;
  listing_status: string;
}

/**
 * The provider dashboard for one listing. Data comes through the signed-in browser client, so row level security decides
 * what each member role sees; the forms hide what a role cannot do, and the database refuses it anyway.
 */
export function Dashboard({ locale, listings, activeId, tab, userId, categories }: { locale: string; listings: MyListing[]; activeId: string; tab: DashboardTab; userId: string; categories: CategoryOption[] }) {
  const t = partnersT(locale);
  const { data, error, reload } = useDashData(activeId);
  const href = (k: string, id = activeId) => `/partners/dashboard${k === "overview" ? "" : `/${k}`}?p=${id}`;
  const me = data?.members.find((m) => m.user_id === userId)?.role ?? "";
  const props = data ? { locale, t, d: data, userId, role: me, reload } : null;
  return (
    <div className="pt-sec" data-testid="dashboard">
      {listings.length > 1 ? (
        <nav aria-label={t.dashboard.choose}>
          <ul className="pt-tabs" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {listings.map((l) => (
              <li key={l.id}>
                <Link href={href(tab, l.id)} aria-current={l.id === activeId ? "page" : undefined} className="zq-btn">
                  {l.display_name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <nav aria-label={t.dashboard.title} className="pt-tabs">
        {DASHBOARD_TABS.map((k) => (
          <Link key={k} href={href(k)} aria-current={k === tab ? "page" : undefined}>
            {t.dashboard.tabs[k]}
          </Link>
        ))}
      </nav>
      {error ? (
        <p className="zq-error" role="alert">
          {t.loadError}
        </p>
      ) : !props ? (
        <Skeleton height={160} />
      ) : (
        <>
          {tab === "overview" ? <OverviewPanel {...props} /> : null}
          {tab === "profile" ? <ProfilePanel {...props} /> : null}
          {tab === "services" ? <ServicesPanel {...props} categories={categories} /> : null}
          {tab === "pricing" ? <PricingPanel {...props} /> : null}
          {tab === "availability" ? <AvailabilityPanel {...props} /> : null}
          {tab === "inquiries" ? <InquiriesPanel {...props} /> : null}
          {tab === "documents" ? <DocumentsPanel {...props} /> : null}
          {tab === "settings" ? <SettingsPanel {...props} /> : null}
        </>
      )}
    </div>
  );
}
