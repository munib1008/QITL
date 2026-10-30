import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { NotConfigured, SignInNeeded } from "@/components/mufti/states";
import { Pill, VerifiedBadge } from "@/components/mufti/ui";
import { ProfileForm, type OwnProfile } from "@/components/mufti/ProfileForm";
import { ReviewList, type ReviewItem } from "@/components/mufti/ReviewList";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { dreamsT } from "@/lib/i18n/modules/dreams";
import type { CitationRow } from "@/lib/mufti";

export const metadata: Metadata = { title: "Mufti workspace", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The mufti workspace: own profile, assigned questions, the review queue (scholarly reviewers, never one's own
 * answer) and assigned dream requests for dream-qualified scholars. The database authorises every action again.
 */
export default async function MuftiWorkspace({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = muftiT(locale);
  const d = dreamsT(locale);
  const { sb, user } = await getUser();
  const page = (body: React.ReactNode) => (
    <ReadingPage locale={locale} crumbs={[{ label: t.crumbs.workspace }]} title={t.workspace.title} lead={t.workspace.lead}>
      <div className="zq-pagebody qa">{body}</div>
    </ReadingPage>
  );
  if (!sb) return page(<NotConfigured locale={locale} title={t.workspace.notConfigured} body={t.list.notConfiguredBody} />);
  if (!user) return page(<SignInNeeded title={t.workspace.signIn} link={t.ask.signInLink} returnTo="/mufti" />);

  const roles = (await rolesOf(sb, user.id)) as string[];
  const isMufti = roles.includes("mufti");
  const isReviewer = roles.includes("scholarly_reviewer") || roles.includes("admin");
  const profile = (
    await sb.from("mufti_profiles").select("display_name, madhhab, credentials_md, verified_at, dream_qualified_at").eq("user_id", user.id).maybeSingle()
  ).data as OwnProfile | null;

  const [assignedRes, reviewRes, dreamRes] = await Promise.all([
    isMufti
      ? sb.from("mufti_assignments").select("question_id, assigned_at, mufti_questions(id, title, status, visibility)").eq("mufti_id", user.id).order("assigned_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    isReviewer
      ? sb
          .from("mufti_answers")
          .select("id, version, body_md, mufti_id, question_id, mufti_questions(title), mufti_answer_citations(kind, quran_surah, quran_ayah_from, quran_ayah_to, hadith_id, work, locator, note)")
          .eq("status", "submitted")
          .eq("review_status", "pending")
          .neq("mufti_id", user.id)
          .order("updated_at")
          .limit(50)
      : Promise.resolve({ data: [] }),
    profile?.dream_qualified_at
      ? sb.from("dream_request_assignments").select("request_id, role, assigned_at").eq("scholar_id", user.id).order("assigned_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const assigned = (assignedRes.data ?? []) as unknown as Array<{ question_id: string; mufti_questions: { id: string; title: string; status: string; visibility: string } | null }>;
  const reviews: ReviewItem[] = (
    (reviewRes.data ?? []) as unknown as Array<{ id: string; version: number; body_md: string; question_id: string; mufti_questions: { title: string } | null; mufti_answer_citations: CitationRow[] }>
  ).map((r) => ({ id: r.id, version: r.version, body_md: r.body_md, question_id: r.question_id, question_title: r.mufti_questions?.title ?? "", citations: r.mufti_answer_citations }));
  const dreams = (dreamRes.data ?? []) as Array<{ request_id: string; role: string; assigned_at: string }>;

  return page(
    <>
      {!isMufti && !profile ? <p className="qa-notice">{t.workspace.notMuftiBody}</p> : null}
      {profile?.verified_at ? (
        <div className="qa-actions">
          <VerifiedBadge>{t.question.verified}</VerifiedBadge>
          {profile.dream_qualified_at ? <Pill>{t.workspace.dreamQualified}</Pill> : null}
        </div>
      ) : null}
      <ProfileForm profile={profile} locale={locale} />

      {isMufti ? (
        <section className="qa-sec" aria-labelledby="ws-assigned-h">
          <h2 id="ws-assigned-h">{t.workspace.assigned}</h2>
          {assigned.length ? (
            <ul className="qa-list">
              {assigned.map((a) =>
                a.mufti_questions ? (
                  <li key={a.question_id} className="qa-card">
                    <Link className="title" href={`/mufti/questions/${a.question_id}`}>
                      {a.mufti_questions.title}
                    </Link>
                    <div className="qa-meta">
                      <Pill>{t.status[a.mufti_questions.status] ?? a.mufti_questions.status}</Pill>
                      <Pill>{t.visibility[a.mufti_questions.visibility]}</Pill>
                    </div>
                  </li>
                ) : null,
              )}
            </ul>
          ) : (
            <p className="zq-meta">{t.workspace.noAssigned}</p>
          )}
        </section>
      ) : null}

      {isReviewer ? (
        <section className="qa-sec" aria-labelledby="ws-review-h">
          <h2 id="ws-review-h">{t.workspace.review}</h2>
          <p className="zq-meta">{t.workspace.reviewOnlyStaff}</p>
          <ReviewList items={reviews} locale={locale} />
        </section>
      ) : null}

      {profile?.dream_qualified_at ? (
        <section className="qa-sec" aria-labelledby="ws-dreams-h">
          <h2 id="ws-dreams-h">{t.workspace.dreams}</h2>
          {dreams.length ? (
            <ul className="qa-list">
              {dreams.map((r) => (
                <li key={r.request_id} className="qa-card">
                  <Link className="title" href={`/mufti/dreams/${r.request_id}`}>
                    {d.scholar.title} <span dir="ltr">{r.request_id.slice(0, 8)}</span>
                  </Link>
                  <div className="qa-meta">
                    <Pill>{d.scholar.roles[r.role] ?? r.role}</Pill>
                    <span>{new Date(r.assigned_at).toLocaleDateString(locale)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="zq-meta">{t.workspace.noDreams}</p>
          )}
        </section>
      ) : null}
    </>,
  );
}
