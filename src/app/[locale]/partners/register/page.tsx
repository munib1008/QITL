import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { NotConfigured, SignInNeeded } from "@/components/mufti/states";
import { RegisterWizard } from "@/components/partners/RegisterWizard";
import { PaymentsNotice, ScopeNotices } from "@/components/partners/shared";
import { getPublicSupabase, getUser } from "@/lib/supabase/server";
import { partnersT } from "@/lib/i18n/modules/partners";
import { loadCategories } from "@/lib/partners/queries";
import { categoryName, groupByTrack } from "@/lib/partners/taxonomy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: partnersT((await params).locale).register.title, robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

/** Provider registration. Signed-in users only; creates a DRAFT that QITL staff review before it is listed. */
export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = partnersT(locale);
  const page = (body: React.ReactNode) => (
    <ReadingPage locale={locale} crumbs={[{ label: t.crumb, href: "/partners" }, { label: t.register.title }]} title={t.register.title} lead={t.register.lead}>
      <div className="zq-pagebody pt">{body}</div>
    </ReadingPage>
  );
  const { sb, user } = await getUser();
  if (!sb) return page(<><NotConfigured locale={locale} title={t.notConnected} body={t.notConnectedBody} /><PaymentsNotice t={t} /></>);
  if (!user) return page(<><SignInNeeded title={t.register.signIn} link={t.signInLink} returnTo="/partners/register" /><PaymentsNotice t={t} /></>);
  const pub = getPublicSupabase() ?? sb;
  const categories = groupByTrack(await loadCategories(pub)).flatMap((g) => g.items.map((c) => ({ id: c.id, name: categoryName(c, locale), track: c.track })));
  return page(
    <>
      <PaymentsNotice t={t} />
      <RegisterWizard locale={locale} categories={categories} />
      <ScopeNotices t={t} />
    </>,
  );
}
