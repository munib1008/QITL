import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { NotConfigured, SignInNeeded } from "@/components/mufti/states";
import { Pill } from "@/components/mufti/ui";
import { ApplyForm } from "@/components/mufti/ApplyForm";
import { getUser } from "@/lib/supabase/server";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { muftiApplyT } from "@/lib/i18n/modules/muftiApply";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: muftiApplyT((await params).locale).title, robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

interface AppRow {
  id: string;
  status: string;
  created_at: string;
  decision_note: string | null;
}

/**
 * Apply to be considered as a mufti. A request to administrators: it grants no role, creates no profile and verifies
 * nothing. The applicant sees their own applications and the status an administrator gave them.
 */
export default async function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = muftiApplyT(locale);
  const m = muftiT(locale);
  const { sb, user } = await getUser();
  const page = (body: React.ReactNode) => (
    <ReadingPage locale={locale} crumbs={[{ label: m.crumbs.workspace, href: "/mufti" }, { label: t.crumb }]} title={t.title} lead={t.lead}>
      <div className="zq-pagebody qa">{body}</div>
    </ReadingPage>
  );
  if (!sb) return page(<NotConfigured locale={locale} title={t.notConfigured} body={t.notConfiguredBody} />);
  if (!user) return page(<SignInNeeded title={t.signIn} link={t.signInLink} returnTo="/mufti/apply" />);

  const [appsRes, verifiedRes] = await Promise.all([
    sb.from("mufti_applications").select("id, status, created_at, decision_note").eq("applicant_id", user.id).order("created_at", { ascending: false }).limit(20),
    sb.rpc("is_verified_mufti", { u: user.id }),
  ]);
  const apps = (appsRes.data ?? []) as AppRow[];
  const open = apps.some((a) => a.status === "submitted" || a.status === "under_review");
  const verifiedMufti = verifiedRes.data === true;

  return page(
    <>
      {verifiedMufti ? (
        <p className="qa-notice">
          {t.verifiedMufti}{" "}
          <Link href="/mufti">{t.workspace}</Link>
        </p>
      ) : open ? (
        <p className="qa-notice">{t.mine.inProgress}</p>
      ) : (
        <ApplyForm locale={locale} />
      )}

      <section className="qa-sec" aria-labelledby="ap-mine-h">
        <h2 id="ap-mine-h">{t.mine.title}</h2>
        {appsRes.error ? (
          <p className="zq-error" role="alert">
            {t.mine.loadError}
          </p>
        ) : !apps.length ? (
          <p className="zq-meta">{t.mine.empty}</p>
        ) : (
          <ul className="qa-list">
            {apps.map((a) => (
              <li key={a.id} className="qa-card" data-testid="my-application">
                <div className="qa-meta">
                  <Pill>{t.status[a.status] ?? a.status}</Pill>
                  <span>
                    {t.mine.sentOn} {new Date(a.created_at).toLocaleDateString(locale)}
                  </span>
                </div>
                {a.status === "verified" ? <p className="zq-meta">{t.verifiedNote}</p> : null}
                {a.decision_note ? (
                  <p>
                    <b>{t.mine.note}: </b>
                    {a.decision_note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>,
  );
}
