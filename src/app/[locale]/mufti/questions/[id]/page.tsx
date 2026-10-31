import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { NotConfigured, SignInNeeded } from "@/components/mufti/states";
import { Pill } from "@/components/mufti/ui";
import { AnswerComposer, type OwnAnswer } from "@/components/mufti/AnswerComposer";
import { getUser } from "@/lib/supabase/server";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { UUID_RE } from "@/lib/mufti";

export const metadata: Metadata = { title: "Answer composer", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The assigned mufti's composer for one question. */
export default async function ComposerPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const t = muftiT(locale);
  const { sb, user } = await getUser();
  const page = (title: string, body: React.ReactNode) => (
    <ReadingPage locale={locale} crumbs={[{ href: "/mufti", label: t.crumbs.workspace }, { label: title }]} title={title}>
      <div className="zq-pagebody qa">{body}</div>
    </ReadingPage>
  );
  if (!sb) return page(t.composer.title, <NotConfigured locale={locale} title={t.workspace.notConfigured} body={t.list.notConfiguredBody} />);
  if (!user) return page(t.composer.title, <SignInNeeded title={t.workspace.signIn} link={t.ask.signInLink} returnTo={`/mufti/questions/${id}`} />);

  const [qRes, aRes, asRes] = await Promise.all([
    sb.from("mufti_questions").select("id, title, body, visibility, status, topic_ref").eq("id", id).maybeSingle(),
    sb
      .from("mufti_answers")
      .select("id, body_md, status, review_status, review_note, version, mufti_answer_citations(id, kind, quran_surah, quran_ayah_from, quran_ayah_to, hadith_id, work, locator, note)")
      .eq("question_id", id)
      .eq("mufti_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
    sb.from("mufti_assignments").select("mufti_id").eq("question_id", id).eq("mufti_id", user.id).maybeSingle(),
  ]);
  const q = qRes.data as { id: string; title: string; body: string; visibility: string; status: string; topic_ref: string | null } | null;
  if (!q || !asRes.data)
    return page(
      t.composer.title,
      <EmptyState title={t.composer.notAssigned}>
        <p>{t.question.notFoundBody}</p>
      </EmptyState>,
    );
  const raw = (aRes.data ?? [])[0] as (Omit<OwnAnswer, "citations"> & { mufti_answer_citations: OwnAnswer["citations"] }) | undefined;
  const answer: OwnAnswer | null = raw ? { ...raw, citations: raw.mufti_answer_citations } : null;
  return page(
    q.title,
    <>
      <div className="qa-meta">
        <Pill>{t.status[q.status] ?? q.status}</Pill>
        <Pill>{t.visibility[q.visibility]}</Pill>
        {q.topic_ref ? <span dir="ltr">{q.topic_ref}</span> : null}
      </div>
      <div className="qa-quote">{q.body}</div>
      <AnswerComposer questionId={q.id} answer={answer} locale={locale} />
    </>,
  );
}
