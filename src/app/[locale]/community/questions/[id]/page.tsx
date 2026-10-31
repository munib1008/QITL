import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { Markdown } from "@/components/ui/Markdown";
import { NotConfigured } from "@/components/mufti/states";
import { CitationList, Pill, VerifiedBadge, type HadithLookup } from "@/components/mufti/ui";
import { FollowButton } from "@/components/mufti/FollowButton";
import { getUser } from "@/lib/supabase/server";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { UUID_RE, type CitationRow } from "@/lib/mufti";

export const metadata: Metadata = { title: "Question to muftis" };
export const dynamic = "force-dynamic";

interface Question {
  id: string;
  title: string;
  body: string;
  visibility: string;
  status: string;
  topic_ref: string | null;
  created_at: string;
}
interface Answer {
  id: string;
  mufti_id: string;
  body_md: string;
  review_note: string | null;
  version: number;
  updated_at: string;
  mufti_answer_citations: CitationRow[];
}
interface Profile {
  user_id: string;
  display_name: string;
  madhhab: string | null;
  verified_at: string | null;
}

/**
 * One question with every published answer side by side. Each answer shows its citations, the verified-mufti badge
 * and the independent-review note. QITL does not choose between answers that differ.
 */
export default async function QuestionPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const t = muftiT(locale);
  const crumbs = [
    { href: "/community", label: t.crumbs.community },
    { href: "/community/questions", label: t.crumbs.questions },
  ];
  const { sb, user } = await getUser();
  if (!sb)
    return (
      <ReadingPage locale={locale} crumbs={[...crumbs, { label: t.list.title }]} title={t.list.title}>
        <div className="zq-pagebody">
          <NotConfigured locale={locale} title={t.list.notConfigured} body={t.list.notConfiguredBody} />
        </div>
      </ReadingPage>
    );

  const q = (await sb.from("mufti_questions").select("id, title, body, visibility, status, topic_ref, created_at").eq("id", id).maybeSingle()).data as Question | null;
  if (!q)
    return (
      <ReadingPage locale={locale} crumbs={[...crumbs, { label: t.question.notFound }]} title={t.question.notFound}>
        <div className="zq-pagebody">
          <EmptyState title={t.question.notFound}>
            <p>{t.question.notFoundBody}</p>
          </EmptyState>
        </div>
      </ReadingPage>
    );

  const answers = ((
    await sb
      .from("mufti_answers")
      .select("id, mufti_id, body_md, review_note, version, updated_at, mufti_answer_citations(kind, quran_surah, quran_ayah_from, quran_ayah_to, hadith_id, work, locator, note)")
      .eq("question_id", id)
      .eq("status", "published")
      .order("created_at")
  ).data ?? []) as Answer[];
  const ids = [...new Set(answers.map((a) => a.mufti_id))];
  const hadithIds = [...new Set(answers.flatMap((a) => a.mufti_answer_citations.map((c) => c.hadith_id)).filter((x): x is string => Boolean(x)))];
  const [profilesRes, hadithRes, followRes] = await Promise.all([
    ids.length ? sb.from("mufti_profiles").select("user_id, display_name, madhhab, verified_at").in("user_id", ids) : Promise.resolve({ data: [] }),
    hadithIds.length ? sb.from("hadith_entries").select("id, collection_id, canonical_number").in("id", hadithIds) : Promise.resolve({ data: [] }),
    user ? sb.from("mufti_question_follows").select("question_id").eq("question_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const profiles = new Map(((profilesRes.data ?? []) as Profile[]).map((p) => [p.user_id, p]));
  const hadith: HadithLookup = Object.fromEntries(((hadithRes.data ?? []) as Array<{ id: string; collection_id: string; canonical_number: string }>).map((h) => [h.id, h]));

  return (
    <ReadingPage
      locale={locale}
      crumbs={[...crumbs, { label: q.title }]}
      title={q.title}
      meta={
        <span className="qa-meta">
          <Pill>{t.status[q.status] ?? q.status}</Pill>
          <Pill>{t.visibility[q.visibility] ?? q.visibility}</Pill>
          {q.topic_ref ? <span dir="ltr">{q.topic_ref}</span> : null}
          <span>
            {t.list.asked} {new Date(q.created_at).toLocaleDateString(locale)}
          </span>
        </span>
      }
    >
      <div className="zq-pagebody qa">
        {q.visibility === "private" ? <p className="qa-notice">{t.question.privateNote}</p> : null}
        <div className="qa-quote">{q.body}</div>
        {user ? (
          <FollowButton questionId={q.id} initial={Boolean(followRes.data)} locale={locale} />
        ) : (
          <p className="zq-meta">
            <Link href={`/sign-in?returnTo=${encodeURIComponent(`/community/questions/${q.id}`)}`}>{t.question.followSignIn}</Link>
          </p>
        )}
        <section className="qa-sec" aria-labelledby="answers-h">
          <h2 id="answers-h">{t.question.answersTitle}</h2>
          <p className="qa-notice" data-testid="no-winner">
            {t.question.noWinner}
          </p>
          {answers.length ? (
            <ol className="qa-answers" data-testid="answers">
              {answers.map((a) => {
                const p = profiles.get(a.mufti_id);
                return (
                  <li key={a.id} className="qa-card" aria-label={p?.display_name}>
                    <div className="qa-actions">
                      <b>{p?.display_name ?? "—"}</b>
                      {p?.verified_at ? <VerifiedBadge>{t.question.verified}</VerifiedBadge> : null}
                      {p?.madhhab ? (
                        <Pill>
                          {t.question.madhhab}: {t.workspace.madhhabs[p.madhhab] ?? p.madhhab}
                        </Pill>
                      ) : null}
                    </div>
                    <div className="qa-body">
                      <Markdown source={a.body_md} />
                    </div>
                    <h3>{t.question.evidence}</h3>
                    <CitationList cites={a.mufti_answer_citations} labels={t.cite} hadith={hadith} empty={t.question.noCitations} />
                    <p className="zq-meta">{t.question.reviewNote}</p>
                    {a.review_note ? (
                      <p className="zq-meta">
                        <b>{t.question.reviewerNote}:</b> {a.review_note}
                      </p>
                    ) : null}
                    <p className="zq-meta">
                      {t.question.version(a.version)} · {new Date(a.updated_at).toLocaleDateString(locale)}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState title={t.question.noAnswers}>
              <p>{t.question.noAnswersBody}</p>
            </EmptyState>
          )}
        </section>
      </div>
    </ReadingPage>
  );
}
