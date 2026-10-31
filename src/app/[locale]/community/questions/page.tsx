import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { NotConfigured } from "@/components/mufti/states";
import { Pill } from "@/components/mufti/ui";
import { getPublicSupabase } from "@/lib/supabase/server";
import { muftiT } from "@/lib/i18n/modules/mufti";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const l = (await params).locale;
  const t = muftiT(l).list;
  return { title: t.title, description: t.lead };
}
export const revalidate = 300;

interface Row {
  id: string;
  title: string;
  status: string;
  topic_type: string | null;
  topic_ref: string | null;
  created_at: string;
  mufti_answers: Array<{ count: number }>;
}

/** Public list of accepted public questions. Anonymous, cookie-free reads keep it cacheable (ISR). */
export default async function QuestionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = muftiT(locale);
  const sb = getPublicSupabase();
  const rows = sb
    ? ((
        await sb
          .from("mufti_questions")
          .select("id, title, status, topic_type, topic_ref, created_at, mufti_answers(count)")
          .eq("visibility", "public")
          .in("status", ["accepted", "assigned", "answered", "closed"])
          .order("created_at", { ascending: false })
          .limit(50)
      ).data as Row[] | null)
    : null;
  return (
    <ReadingPage locale={locale} crumbs={[{ href: "/community", label: t.crumbs.community }, { label: t.crumbs.questions }]} title={t.list.title} lead={t.list.lead}>
      <div className="zq-pagebody qa">
        <p>
          <Link className="zq-btn zq-btn-primary" href="/community/questions/ask">
            {t.list.ask}
          </Link>
        </p>
        {!sb ? (
          <NotConfigured locale={locale} title={t.list.notConfigured} body={t.list.notConfiguredBody} />
        ) : rows?.length ? (
          <ol className="qa-list" data-testid="question-list">
            {rows.map((q) => (
              <li key={q.id} className="qa-card">
                <Link className="title" href={`/community/questions/${q.id}`}>
                  {q.title}
                </Link>
                <div className="qa-meta">
                  <Pill>{t.status[q.status] ?? q.status}</Pill>
                  <span>{t.list.answers(q.mufti_answers[0]?.count ?? 0)}</span>
                  {q.topic_ref ? <span dir="ltr">{q.topic_ref}</span> : null}
                  <span>
                    {t.list.asked} {new Date(q.created_at).toLocaleDateString(locale)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title={t.list.empty}>
            <p>{t.list.emptyBody}</p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
