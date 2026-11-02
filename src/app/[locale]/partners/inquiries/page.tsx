import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { NotConfigured, SignInNeeded } from "@/components/mufti/states";
import { LearnerInquiries } from "@/components/partners/LearnerInquiries";
import { PaymentsNotice } from "@/components/partners/shared";
import { getUser } from "@/lib/supabase/server";
import { partnersT } from "@/lib/i18n/modules/partners";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: partnersT((await params).locale).learner.title, robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

/** A learner's inquiries to providers. Private: the learner only. */
export default async function MyInquiriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = partnersT(locale);
  const page = (body: React.ReactNode) => (
    <ReadingPage locale={locale} crumbs={[{ label: t.crumb, href: "/partners" }, { label: t.learner.title }]} title={t.learner.title} lead={t.learner.lead}>
      <div className="zq-pagebody pt">{body}</div>
    </ReadingPage>
  );
  const { sb, user } = await getUser();
  if (!sb) return page(<NotConfigured locale={locale} title={t.notConnected} body={t.notConnectedBody} />);
  if (!user) return page(<SignInNeeded title={t.signInTitle} link={t.signInLink} returnTo="/partners/inquiries" />);
  return page(
    <>
      <LearnerInquiries locale={locale} />
      <PaymentsNotice t={t} />
    </>,
  );
}
