import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState, SearchField } from "@/components/ui/misc";
import { searchJourney, type SearchHit } from "@/lib/search";
import { getServerSupabase } from "@/lib/supabase/server";
import { englishContent } from "@/lib/i18n/locales";
import { searchStrings } from "@/lib/i18n/modules/search";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: searchStrings((await params).locale).title, robots: { index: false } };
}

const FACET_IDS = ["prophets", "milestones", "quran", "stories", "events", "hadith", "last_hour"];

export default async function SearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; facet?: string }> }) {
  const { locale } = await params;
  const { q = "", facet } = await searchParams;
  const t = searchStrings(locale);
  const en = englishContent(locale);
  const FACETS: Array<[string, string]> = FACET_IDS.map((f) => [f, t.facets[f] ?? f]);
  const query = q.trim().slice(0, 120);
  let hits: SearchHit[] = query ? searchJourney(query) : [];
  const sb = query ? await getServerSupabase() : null;
  if (sb) {
    const { data } = await sb.rpc("search", { q: query, facets: null, lim: 50, off: 0 });
    for (const r of (data ?? []) as Array<{ entity_type: string; entity_id: string; url: string; title: string; title_ar: string | null; snippet: string; facet: SearchHit["facet"]; rank: number }>)
      hits.push({ type: r.entity_type, id: r.entity_id, url: r.url, title: r.title, titleAr: r.title_ar ?? undefined, snippet: r.snippet, facet: r.facet, score: r.rank * 3 });
  }
  const counts = Object.fromEntries(FACETS.map(([f]) => [f, hits.filter((h) => h.facet === f).length]));
  if (facet) hits = hits.filter((h) => h.facet === facet);

  return (
    <ReadingPage locale={locale} crumbs={[{ label: t.title }]} query={query} title={t.title} lead={t.lead}>
      <div className="zq-pagebody">
        <SearchField id="page-q" defaultValue={query} maxWidth={640} />
        {query ? (
          <>
            <nav className="zq-filters" aria-label={t.filter}>
              <Link className="zq-pill" href={`/search?q=${encodeURIComponent(query)}`} aria-current={!facet || undefined}>
                {t.all} ({Object.values(counts).reduce((a, b) => a + b, 0)})
              </Link>
              {FACETS.filter(([f]) => counts[f]).map(([f, label]) => (
                <Link key={f} className="zq-pill" href={`/search?q=${encodeURIComponent(query)}&facet=${f}`} aria-current={facet === f || undefined}>
                  {label} ({counts[f]})
                </Link>
              ))}
            </nav>
            <p className="zq-meta" role="status">
              {t.results(hits.length, query)}
              {sb ? "" : t.journeyOnly}.
            </p>
            {hits.length ? (
              <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {hits.map((h) => (
                  <li key={h.url} className="zq-result">
                    <span className="zq-eyebrow">{FACETS.find(([f]) => f === h.facet)?.[1] ?? h.facet}</span>
                    <Link className="title" href={h.url}>
                      <span {...en}>{h.title}</span>{" "}
                      {h.titleAr ? (
                        <span lang="ar" dir="rtl" className="zq-jc-sar">
                          {h.titleAr}
                        </span>
                      ) : null}
                    </Link>
                    <span className="zq-meta" {...en}>
                      {h.snippet}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title={t.nothing(query)}>
                <p>
                  {t.tryOther} <Link href="/prophets">{t.prophets}</Link> {t.or} <Link href="/quran">{t.surahs}</Link>.
                </p>
              </EmptyState>
            )}
          </>
        ) : (
          <p className="zq-meta">{t.prompt}</p>
        )}
      </div>
    </ReadingPage>
  );
}
