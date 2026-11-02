import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { NotConfigured, SignInNeeded } from "@/components/mufti/states";
import { Dashboard, DASHBOARD_TABS, type DashboardTab, type MyListing } from "@/components/partners/Dashboard";
import { PaymentsNotice } from "@/components/partners/shared";
import { getPublicSupabase, getUser } from "@/lib/supabase/server";
import { partnersT } from "@/lib/i18n/modules/partners";
import { loadCategories } from "@/lib/partners/queries";
import { categoryName, groupByTrack } from "@/lib/partners/taxonomy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: partnersT((await params).locale).dashboard.title, robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

/** Provider dashboard (also /partners/dashboard/<tab>?p=<listing id>). Members of a listing only; RLS limits every read. */
export default async function DashboardPage({ params, searchParams }: { params: Promise<{ locale: string; tab?: string[] }>; searchParams: Promise<{ p?: string }> }) {
  const { locale, tab: tabParts } = await params;
  const { p } = await searchParams;
  const t = partnersT(locale);
  const tab = ((tabParts ?? [])[0] ?? "overview") as DashboardTab;
  const page = (body: React.ReactNode) => (
    <ReadingPage locale={locale} crumbs={[{ label: t.crumb, href: "/partners" }, { label: t.dashboard.title }]} title={t.dashboard.title} lead={t.dashboard.lead}>
      <div className="zq-pagebody pt">{body}</div>
    </ReadingPage>
  );
  const { sb, user } = await getUser();
  if (!sb) return page(<><NotConfigured locale={locale} title={t.notConnected} body={t.notConnectedBody} /><PaymentsNotice t={t} /></>);
  if (!user) return page(<SignInNeeded title={t.signInTitle} link={t.signInLink} returnTo="/partners/dashboard" />);
  if (!DASHBOARD_TABS.includes(tab)) return page(<EmptyState title={t.provider.notFound} />);

  const { data: mine } = await sb.from("partner_members").select("partner_id, role, learning_partners(id, slug, display_name, listing_status)").eq("user_id", user.id);
  const listings: MyListing[] = ((mine ?? []) as unknown as Array<{ learning_partners: MyListing | MyListing[] | null }>)
    .map((r) => (Array.isArray(r.learning_partners) ? r.learning_partners[0] : r.learning_partners))
    .filter((x): x is MyListing => Boolean(x));
  if (!listings.length)
    return page(
      <EmptyState title={t.dashboard.noListing}>
        <p>{t.dashboard.noListingBody}</p>
        <p>
          <Link className="zq-btn zq-btn-primary" href="/partners/register">
            {t.directory.registerCta}
          </Link>
        </p>
      </EmptyState>,
    );
  const active = listings.find((l) => l.id === p) ?? listings[0]!;
  const categories = groupByTrack(await loadCategories(getPublicSupabase() ?? sb)).flatMap((g) => g.items.map((c) => ({ id: c.id, name: categoryName(c, locale), track: c.track })));
  return page(
    <>
      <PaymentsNotice t={t} />
      <Dashboard locale={locale} listings={listings} activeId={active.id} tab={tab} userId={user.id} categories={categories} />
    </>,
  );
}
