import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { EmptyState } from "@/components/ui/misc";
import { Icon } from "@/components/ui/icons";
import { fill, searchStrings } from "@/lib/i18n/modules/search";
import { MAX_QUERY, unifiedSearch } from "@/lib/search-engine";
import { quranSource } from "@/lib/search-sources";
import type { Facet, SearchHit } from "@/lib/search";
import "@/styles/search.css";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

function href(q: string, facet: Facet | null, page = 1): string {
  const p = new URLSearchParams({ q });
  if (facet) p.set("facet", facet);
  if (page > 1) p.set("page", String(page));
  return `/search?${p.toString()}`;
}

/** Page numbers to show: first, last, and two either side of the current one. */
function pageList(page: number, pages: number): Array<number | "gap"> {
  const out: Array<number | "gap"> = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 2) out.push(n);
    else if (out[out.length - 1] !== "gap") out.push("gap");
  }
  return out;
}

function Hit({ h, label, t }: { h: SearchHit; label: string; t: ReturnType<typeof searchStrings> }) {
  const ref = h.type === "ayah" ? h.id : null;
  return (
    <li className="sr-hit" data-facet={h.facet}>
      <span className="zq-eyebrow">{label}</span>
      <Link className="sr-link" href={h.url} aria-label={ref ? fill(t.openAyah, { ref: `Q ${ref}` }) : undefined}>
        <span>{h.title}</span>
        {h.titleAr ? (
          <span lang="ar" dir="rtl" className="sr-ar">
            {h.titleAr}
          </span>
        ) : null}
      </Link>
      {h.arabic ? (
        <p className="sr-ayah" lang="ar" dir="rtl" data-verbatim-quran>
          {h.arabic}
        </p>
      ) : null}
      {h.snippet ? <p className="zq-meta sr-snippet">{h.snippet}</p> : null}
    </li>
  );
}

export default async function SearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[]; facet?: string | string[]; page?: string | string[] }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const query = one(sp.q).trim().slice(0, MAX_QUERY);
  const t = searchStrings(locale);
  const r = await unifiedSearch({ q: query, facet: one(sp.facet) || null, page: Number(one(sp.page)) || 1, locale });
  const all = Object.values(r.facets).reduce((a, b) => a + (b ?? 0), 0);
  const showsQuran = r.results.some((h) => h.arabic);

  return (
    <ReadingPage locale={locale} crumbs={[{ label: t.title }]} query={query} title={t.title} lead={t.lead}>
      <div className="zq-pagebody">
        <form role="search" action="/search" method="get" className="sr-form">
          <div className="zq-field zq-search">
            <label htmlFor="page-q" className="sr-only">
              {t.fieldLabel}
            </label>
            <Icon.search />
            <input id="page-q" name="q" className="zq-input" type="search" placeholder={t.placeholder} defaultValue={query} autoComplete="off" maxLength={MAX_QUERY} />
          </div>
          {r.facet ? <input type="hidden" name="facet" value={r.facet} /> : null}
          <button type="submit" className="zq-btn zq-btn-primary sr-submit">
            {t.submit}
          </button>
        </form>
        {query ? (
          <>
            {all ? (
              <nav className="sr-facets" aria-label={t.filters}>
                <Link className="zq-pill" href={href(query, null)} aria-current={!r.facet || undefined}>
                  {t.all}
                  <b>{all}</b>
                </Link>
                {(Object.keys(r.facets) as Facet[]).map((f) => (
                  <Link key={f} className="zq-pill" href={href(query, f)} aria-current={r.facet === f || undefined} data-facet={f}>
                    {t.facets[f]}
                    <b>{r.facets[f]}</b>
                  </Link>
                ))}
              </nav>
            ) : null}
            <p className="zq-meta sr-status" role="status">
              {fill(r.total === 1 ? t.results.one : t.results.many, { n: r.total, q: query })}
              {r.pages > 1 ? ` · ${fill(t.pageOf, { n: r.page, total: r.pages })}` : ""}
              {r.database === "not_configured" ? ` ${t.partial}` : r.database === "error" ? ` ${t.dbError}` : ""}
            </p>
            {r.results.length ? (
              <>
                <ol className="sr-list" start={(r.page - 1) * r.perPage + 1}>
                  {r.results.map((h) => (
                    <Hit key={`${h.url}|${h.id}`} h={h} label={t.facets[h.facet]} t={t} />
                  ))}
                </ol>
                {showsQuran ? <QuranAttribution src={quranSource()} className="zq-meta sr-attrib" /> : null}
                {r.pages > 1 ? (
                  <nav className="sr-pager" aria-label={t.pagination}>
                    {r.page > 1 ? (
                      <Link href={href(query, r.facet, r.page - 1)} rel="prev">
                        {t.prev}
                      </Link>
                    ) : null}
                    {pageList(r.page, r.pages).map((n, i) =>
                      n === "gap" ? (
                        <span key={`gap-${i}`} className="sr-gap" aria-hidden="true">
                          …
                        </span>
                      ) : n === r.page ? (
                        <span key={n} aria-current="page">
                          {n}
                        </span>
                      ) : (
                        <Link key={n} href={href(query, r.facet, n)} aria-label={fill(t.pageN, { n })}>
                          {n}
                        </Link>
                      ),
                    )}
                    {r.page < r.pages ? (
                      <Link href={href(query, r.facet, r.page + 1)} rel="next">
                        {t.next}
                      </Link>
                    ) : null}
                  </nav>
                ) : null}
              </>
            ) : (
              <EmptyState title={fill(t.emptyTitle, { q: query })}>
                <p>
                  {t.emptyHelp} <Link href="/prophets">{t.prophetsLink}</Link> · <Link href="/quran">{t.surahsLink}</Link>
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
