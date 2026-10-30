import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { NotConfigured, SignInNeeded } from "@/components/mufti/states";
import { Pill } from "@/components/mufti/ui";
import { DreamScholarWorkspace, type ScholarResponse } from "@/components/dreams/DreamScholarWorkspace";
import { getUser } from "@/lib/supabase/server";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { dreamsT } from "@/lib/i18n/modules/dreams";
import { UUID_RE } from "@/lib/mufti";

export const metadata: Metadata = { title: "Dream request", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * A qualified scholar's view of one assigned dream request. RLS returns the request only while the scholar is
 * assigned, still qualified, and the submitter's consent stands; otherwise this page shows nothing of it.
 */
export default async function ScholarDreamPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const t = dreamsT(locale);
  const m = muftiT(locale);
  const { sb, user } = await getUser();
  const page = (body: React.ReactNode) => (
    <ReadingPage locale={locale} crumbs={[{ href: "/mufti", label: m.crumbs.workspace }, { label: t.scholar.title }]} title={t.scholar.title} lead={t.scholar.lead}>
      <div className="zq-pagebody qa">{body}</div>
    </ReadingPage>
  );
  if (!sb) return page(<NotConfigured locale={locale} title={m.workspace.notConfigured} body={m.list.notConfiguredBody} />);
  if (!user) return page(<SignInNeeded title={m.workspace.signIn} link={m.ask.signInLink} returnTo={`/mufti/dreams/${id}`} />);

  const [reqRes, asRes, respRes, soRes] = await Promise.all([
    sb.from("dream_requests").select("id, dream_text, question, language, status, created_at").eq("id", id).maybeSingle(),
    sb.from("dream_request_assignments").select("role").eq("request_id", id).eq("scholar_id", user.id).maybeSingle(),
    sb
      .from("dream_scholar_responses")
      .select("id, scholar_id, outcome, body_md, status, review_status, version, fallibility_acknowledged, dream_reference_links(id, kind, quran_surah, quran_ayah_from, quran_ayah_to, hadith_id, work, locator, note)")
      .eq("request_id", id)
      .order("created_at"),
    sb.from("dream_second_opinions").select("id").eq("request_id", id).eq("status", "assigned").maybeSingle(),
  ]);
  const req = reqRes.data as { id: string; dream_text: string; question: string | null; language: string; status: string; created_at: string } | null;
  const role = (asRes.data as { role: string } | null)?.role;
  if (!req || !role)
    return page(
      <EmptyState title={t.scholar.notAssigned}>
        <p>{t.detail.notFoundBody}</p>
      </EmptyState>,
    );
  const all = ((respRes.data ?? []) as Array<Omit<ScholarResponse, "references"> & { scholar_id: string; dream_reference_links: ScholarResponse["references"] }>).map(
    ({ dream_reference_links, ...r }) => ({ ...r, references: dream_reference_links }),
  );
  const mine = all.find((r) => r.scholar_id === user.id) ?? null;
  const others = all.filter((r) => r.scholar_id !== user.id);

  return page(
    <>
      <div className="qa-meta">
        <Pill>
          {t.scholar.roleLabel}: {t.scholar.roles[role] ?? role}
        </Pill>
        <Pill>{t.status[req.status] ?? req.status}</Pill>
        <Pill>{t.form.languages[req.language] ?? req.language}</Pill>
        <span>{new Date(req.created_at).toLocaleDateString(locale)}</span>
      </div>
      <section className="qa-sec" aria-labelledby="sd-dream-h">
        <h2 id="sd-dream-h">{t.scholar.dreamText}</h2>
        <div className="qa-quote" lang={req.language} dir={req.language === "en" ? "ltr" : "rtl"}>
          {req.dream_text}
        </div>
        {req.question ? (
          <>
            <h3>{t.scholar.question}</h3>
            <div className="qa-quote" lang={req.language} dir={req.language === "en" ? "ltr" : "rtl"}>
              {req.question}
            </div>
          </>
        ) : null}
      </section>
      <DreamScholarWorkspace requestId={req.id} role={role} mine={mine} others={others} secondOpinionId={(soRes.data as { id: string } | null)?.id ?? null} locale={locale} />
    </>,
  );
}
