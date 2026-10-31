import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { CommunityCard, CountsNote } from "@/components/encyclopedia/Encyclopedia";
import { EmptyState } from "@/components/ui/misc";
import { communityCounts, publishedCommunities } from "@/lib/data/encyclopedia";
import { getDict } from "@/lib/i18n";
import { encyclopediaStrings } from "@/lib/i18n/modules/encyclopedia";
import { fill } from "@/lib/i18n/modules/search";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = encyclopediaStrings((await params).locale).communities;
  return { title: s.title, description: s.lead };
}

export default async function CommunitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const t = encyclopediaStrings(locale);
  const [list, counts] = await Promise.all([publishedCommunities(), communityCounts()]);
  return (
    <ReadingPage locale={raw} crumbs={[{ label: t.communities.crumb }]} kicker={t.communities.kicker} title={t.communities.title} lead={t.communities.lead}>
      <div className="zq-pagebody he-page">
        {list?.length ? (
          <>
            <p className="zq-meta" role="status" data-testid="community-count">
              {fill(list.length === 1 ? t.communities.count.one : t.communities.count.many, { n: list.length })}
            </p>
            <ul className="he-grid" data-testid="community-grid">
              {list.map((c) => (
                <CommunityCard key={c.slug} c={c} locale={locale} t={t} />
              ))}
            </ul>
          </>
        ) : (
          <EmptyState title={list ? t.communities.emptyTitle : t.communities.notConnected}>
            <p>{t.communities.emptyBody}</p>
            {list ? <CountsNote counts={counts} labels={t.people} /> : null}
            <p>
              <Link href="/people">{t.people.nav}</Link>
            </p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
