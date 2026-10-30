import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Community", description: "Respectful discussion attached to the sources. Reading is open to all." };

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const sb = await getServerSupabase();
  const threads = sb
    ? (await sb.from("discussions").select("id, title, content_type, content_id, status, created_at, comments(count)").order("created_at", { ascending: false }).limit(50)).data
    : null;
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: "Community" }]}
      title="Community"
      lead="Questions and discussion, each attached to a verse, narration or page. Reading is open to everyone; posting needs an account. Comments are readers' views, not verified knowledge."
    >
      <div className="zq-pagebody">
        <p>
          <Link href="/community/guidelines">Read the discussion guidelines</Link>
        </p>
        {threads?.length ? (
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {threads.map((t: { id: string; title: string; content_type: string; content_id: string; status: string; created_at: string; comments: Array<{ count: number }> }) => (
              <li key={t.id} className="zq-result">
                <Link className="title" href={`/community/${t.id}`}>
                  {t.title}
                </Link>
                <span className="zq-meta">
                  On {t.content_type.replace("_", " ")} {t.content_id} · {t.comments[0]?.count ?? 0} comments · {new Date(t.created_at).toLocaleDateString()}
                  {t.status === "locked" ? " · locked" : ""}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState tone={sb ? "unknown" : "soon"} label={sb ? undefined : <span className="zq-soon">Coming soon</span>} title={sb ? "No discussions yet." : "Discussions are not open yet."}>
            <p>{sb ? "Start one from any prophet, verse or story page." : "The community database is not connected on this site yet. Nothing here is mocked."}</p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
