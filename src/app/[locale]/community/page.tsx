import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { getServerSupabase } from "@/lib/supabase/server";
import { englishContent } from "@/lib/i18n/locales";
import { communityStrings } from "@/lib/i18n/modules/community";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = communityStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = communityStrings(locale);
  const en = englishContent(locale);
  const sb = await getServerSupabase();
  const threads = sb
    ? (await sb.from("discussions").select("id, title, content_type, content_id, status, created_at, comments(count)").order("created_at", { ascending: false }).limit(50)).data
    : null;
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: c.title }]}
      title={c.title}
      lead={c.lead}
    >
      <div className="zq-pagebody">
        <p>
          <Link href="/community/guidelines">{c.guidelinesLink}</Link>
        </p>
        {threads?.length ? (
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {threads.map((t: { id: string; title: string; content_type: string; content_id: string; status: string; created_at: string; comments: Array<{ count: number }> }) => (
              <li key={t.id} className="zq-result">
                <Link className="title" href={`/community/${t.id}`} {...en}>
                  {t.title}
                </Link>
                <span className="zq-meta">
                  {c.on} <span dir="ltr">{t.content_type.replace("_", " ")} {t.content_id}</span> · {c.comments(t.comments[0]?.count ?? 0)} · {new Date(t.created_at).toLocaleDateString(locale)}
                  {t.status === "locked" ? ` · ${c.locked}` : ""}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState tone={sb ? "unknown" : "soon"} label={sb ? undefined : <span className="zq-soon">{c.soon}</span>} title={sb ? c.noDiscussions : c.notOpen}>
            <p>{sb ? c.startFrom : c.notConnected}</p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
