import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { Markdown } from "@/components/ui/Markdown";
import { NotConfigured, SignInNeeded } from "@/components/mufti/states";
import { CitationList, Pill, VerifiedBadge } from "@/components/mufti/ui";
import { DreamRequestActions } from "@/components/dreams/DreamRequestActions";
import { getUser } from "@/lib/supabase/server";
import { dreamsT } from "@/lib/i18n/modules/dreams";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { UUID_RE, type CitationRow } from "@/lib/mufti";

export const metadata: Metadata = { title: "Your dream request", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface Response {
  id: string;
  scholar_id: string;
  outcome: string;
  body_md: string;
  second_opinion_id: string | null;
  updated_at: string;
  dream_reference_links: CitationRow[];
}

/** The submitter's own request: what they wrote, its history, released answers with the fallibility notice, and controls. */
export default async function MyDreamPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const t = dreamsT(locale);
  const m = muftiT(locale);
  const { sb, user } = await getUser();
  const crumbs = [
    { href: "/dreams", label: t.crumbs.dreams },
    { href: "/dreams/my", label: t.crumbs.mine },
    { label: t.detail.title },
  ];
  const page = (body: React.ReactNode) => (
    <ReadingPage locale={locale} crumbs={crumbs} title={t.detail.title}>
      <div className="zq-pagebody qa">{body}</div>
    </ReadingPage>
  );
  if (!sb) return page(<NotConfigured locale={locale} title={t.mine.notConfigured} body={t.mine.notConfiguredBody} />);
  if (!user) return page(<SignInNeeded title={t.mine.signIn} link={t.form.signInLink} returnTo={`/dreams/my/${id}`} />);

  const req = (await sb.from("dream_requests").select("id, dream_text, question, language, status, retain_until, created_at").eq("id", id).eq("user_id", user.id).maybeSingle()).data as {
    id: string;
    dream_text: string;
    question: string | null;
    language: string;
    status: string;
    retain_until: string;
    created_at: string;
  } | null;
  if (!req)
    return page(
      <EmptyState title={t.detail.notFound}>
        <p>{t.detail.notFoundBody}</p>
      </EmptyState>,
    );

  const [histRes, respRes, consentRes, soRes] = await Promise.all([
    sb.from("dream_request_status_history").select("to_status, reason, changed_at").eq("request_id", id).order("changed_at"),
    sb
      .from("dream_scholar_responses")
      .select("id, scholar_id, outcome, body_md, second_opinion_id, updated_at, dream_reference_links(kind, quran_surah, quran_ayah_from, quran_ayah_to, hadith_id, work, locator, note)")
      .eq("request_id", id)
      .eq("status", "released")
      .order("created_at"),
    sb.from("dream_request_consents").select("granted").eq("request_id", id).eq("kind", "scholar_access").order("created_at", { ascending: false }).limit(1),
    sb.from("dream_second_opinions").select("id").eq("request_id", id).in("status", ["requested", "assigned"]).limit(1),
  ]);
  const history = (histRes.data ?? []) as Array<{ to_status: string; reason: string | null; changed_at: string }>;
  const responses = (respRes.data ?? []) as Response[];
  const scholarAccess = Boolean((consentRes.data as Array<{ granted: boolean }> | null)?.[0]?.granted);
  const ids = [...new Set(responses.map((r) => r.scholar_id))];
  const profiles = new Map(
    (((ids.length ? (await sb.from("mufti_profiles").select("user_id, display_name, verified_at").in("user_id", ids)).data : []) ?? []) as Array<{ user_id: string; display_name: string; verified_at: string | null }>).map((p) => [p.user_id, p]),
  );
  const dir = req.language === "en" ? "ltr" : "rtl";

  return page(
    <>
      <div className="qa-meta">
        <Pill>{t.status[req.status] ?? req.status}</Pill>
        <span>
          {t.mine.submitted} {new Date(req.created_at).toLocaleDateString(locale)}
        </span>
        <span>
          {t.mine.deletesOn} {new Date(req.retain_until).toLocaleDateString(locale)}
        </span>
      </div>
      <section className="qa-sec" aria-labelledby="md-dream-h">
        <h2 id="md-dream-h">{t.detail.yourDream}</h2>
        <div className="qa-quote" lang={req.language} dir={dir}>
          {req.dream_text}
        </div>
        {req.question ? (
          <>
            <h3>{t.detail.yourQuestion}</h3>
            <div className="qa-quote" lang={req.language} dir={dir}>
              {req.question}
            </div>
          </>
        ) : null}
      </section>

      <section className="qa-sec" aria-labelledby="md-resp-h">
        <h2 id="md-resp-h">{t.detail.responses}</h2>
        {responses.length ? (
          <ol className="qa-answers">
            {responses.map((r) => {
              const p = profiles.get(r.scholar_id);
              return (
                <li key={r.id} className="qa-card">
                  <div className="qa-actions">
                    {p ? <b>{p.display_name}</b> : null}
                    {p?.verified_at ? <VerifiedBadge>{m.question.verified}</VerifiedBadge> : null}
                    <Pill>{t.outcomes[r.outcome] ?? r.outcome}</Pill>
                    {r.second_opinion_id ? <Pill>{t.detail.secondTitle}</Pill> : null}
                  </div>
                  <p className="qa-notice" data-testid="fallibility">
                    {t.fallibility}
                  </p>
                  <div className="qa-body" lang={req.language} dir={dir}>
                    <Markdown source={r.body_md} />
                  </div>
                  <h3>{t.detail.references}</h3>
                  <CitationList cites={r.dream_reference_links} labels={m.cite} empty={m.question.noCitations} />
                  <p className="zq-meta">{m.question.reviewNote}</p>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="zq-meta">{t.detail.noResponses}</p>
        )}
      </section>

      <section className="qa-sec" aria-labelledby="md-hist-h">
        <h2 id="md-hist-h">{t.detail.history}</h2>
        <ol className="qa-limits">
          {history.map((h, i) => (
            <li key={i}>
              {new Date(h.changed_at).toLocaleString(locale)}: {t.status[h.to_status] ?? h.to_status}
              {h.reason ? ` (${t.reasons[h.reason] ?? h.reason})` : ""}
            </li>
          ))}
        </ol>
      </section>

      <DreamRequestActions
        requestId={req.id}
        status={req.status}
        retainUntil={req.retain_until}
        scholarAccess={scholarAccess}
        releasedResponseId={responses.find((r) => !r.second_opinion_id)?.id ?? null}
        secondOpinionOpen={Boolean((soRes.data ?? []).length)}
        locale={locale}
      />
    </>,
  );
}
