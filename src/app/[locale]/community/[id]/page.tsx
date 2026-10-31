import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { DiscussionThread } from "@/components/community/DiscussionThread";
import { getServerSupabase } from "@/lib/supabase/server";
import { englishContent } from "@/lib/i18n/locales";
import { communityStrings } from "@/lib/i18n/modules/community";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: communityStrings((await params).locale).discussion };
}

export default async function ThreadPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sb = await getServerSupabase();
  const title = sb ? ((await sb.from("discussions").select("title").eq("id", id).maybeSingle()).data as { title: string } | null)?.title : undefined;
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ href: "/community", label: communityStrings(locale).title }, { label: title ?? communityStrings(locale).discussion }]}
      title={title ? <span {...englishContent(locale)}>{title}</span> : communityStrings(locale).discussion}
    >
      <div className="zq-pagebody">
        <DiscussionThread id={id} />
      </div>
    </ReadingPage>
  );
}
