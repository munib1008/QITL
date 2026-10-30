import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState, SearchField } from "@/components/ui/misc";
import { searchJourney, type SearchHit } from "@/lib/search";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

const FACETS: Array<[string, string]> = [
  ["prophets", "Prophets"],
  ["milestones", "Milestones"],
  ["quran", "Quran"],
  ["stories", "Stories"],
  ["events", "Events"],
  ["hadith", "Hadith"],
  ["last_hour", "Last Hour"],
];

export default async function SearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; facet?: string }> }) {
  const { locale } = await params;
  const { q = "", facet } = await searchParams;
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
    <ReadingPage locale={locale} crumbs={[{ label: "Search" }]} query={query} title="Search" lead="Prophets, surahs, stories, events and narrations, in English or Arabic, with or without vowel marks.">
      <div className="zq-pagebody">
        <SearchField id="page-q" defaultValue={query} maxWidth={640} />
        {query ? (
          <>
            <nav className="zq-filters" aria-label="Filter results">
              <Link className="zq-pill" href={`/search?q=${encodeURIComponent(query)}`} aria-current={!facet || undefined}>
                All ({Object.values(counts).reduce((a, b) => a + b, 0)})
              </Link>
              {FACETS.filter(([f]) => counts[f]).map(([f, label]) => (
                <Link key={f} className="zq-pill" href={`/search?q=${encodeURIComponent(query)}&facet=${f}`} aria-current={facet === f || undefined}>
                  {label} ({counts[f]})
                </Link>
              ))}
            </nav>
            <p className="zq-meta" role="status">
              {hits.length} result{hits.length === 1 ? "" : "s"} for “{query}”{sb ? "" : " in the journey content (the full index is not connected on this site yet)"}.
            </p>
            {hits.length ? (
              <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {hits.map((h) => (
                  <li key={h.url} className="zq-result">
                    <span className="zq-eyebrow">{FACETS.find(([f]) => f === h.facet)?.[1] ?? h.facet}</span>
                    <Link className="title" href={h.url}>
                      {h.title}{" "}
                      {h.titleAr ? (
                        <span lang="ar" dir="rtl" className="zq-jc-sar">
                          {h.titleAr}
                        </span>
                      ) : null}
                    </Link>
                    <span className="zq-meta">{h.snippet}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title={`Nothing matched “${query}”.`}>
                <p>Try another spelling (Yusuf, Yousuf, Joseph), the Arabic name (يوسف), or a reference such as 12:4. Browse the <Link href="/prophets">prophets</Link> or the <Link href="/quran">surahs</Link>.</p>
              </EmptyState>
            )}
          </>
        ) : (
          <p className="zq-meta">Type a name, a surah, a place or a reference.</p>
        )}
      </div>
    </ReadingPage>
  );
}
