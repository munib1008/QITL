import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { CountsNote, PersonCard } from "@/components/encyclopedia/Encyclopedia";
import { AiDraftIndex } from "@/components/drafts/AiDraftIndex";
import { EmptyState } from "@/components/ui/misc";
import { peopleCounts, publishedPeople } from "@/lib/data/encyclopedia";
import { groupPeople } from "@/lib/encyclopedia/model";
import { getDict } from "@/lib/i18n";
import { encyclopediaStrings } from "@/lib/i18n/modules/encyclopedia";
import { fill } from "@/lib/i18n/modules/search";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = encyclopediaStrings((await params).locale).people;
  return { title: s.title, description: s.lead };
}

export default async function PeoplePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const t = encyclopediaStrings(locale);
  const [people, counts] = await Promise.all([publishedPeople(), peopleCounts()]);
  const groups = people ? groupPeople(people) : [];
  return (
    <ReadingPage locale={raw} crumbs={[{ label: t.people.crumb }]} kicker={t.people.kicker} title={t.people.title} lead={t.people.lead}>
      <div className="zq-pagebody he-page">
        {groups.length ? (
          <>
            <p className="zq-meta" role="status" data-testid="people-count">
              {fill(people!.length === 1 ? t.people.count.one : t.people.count.many, { n: people!.length })}
            </p>
            {groups.map((g) => (
              <section key={g.group} className="he-group" aria-labelledby={`pg-${g.group}`} data-testid={`people-group-${g.group}`}>
                <h2 id={`pg-${g.group}`}>{t.people.groups[g.group]}</h2>
                <p className="zq-meta he-group-note">{t.people.groupNotes[g.group]}</p>
                <ul className="he-grid">
                  {g.items.map((p) => (
                    <PersonCard key={p.slug} p={p} locale={locale} t={t} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        ) : (
          <EmptyState title={people ? t.people.emptyTitle : t.people.notConnected}>
            <p>{t.people.emptyBody}</p>
            {people ? <CountsNote counts={counts} labels={t.people} /> : null}
            <p>
              <Link href="/communities">{t.communities.nav}</Link>
            </p>
          </EmptyState>
        )}
        <AiDraftIndex types={["person"]} locale={locale} />
      </div>
    </ReadingPage>
  );
}
