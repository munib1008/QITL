"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import { exactCount, parseVerseQuery, pick, sortAndFilter, type FilterKey, type NameListItem, type SortKey } from "@/lib/asma/model";
import { AiDraftBadge, isAiDraft } from "./Parts";

/**
 * The gallery: search by Arabic (with or without marks), English, Urdu, transliteration, root or a verse such as 2:255,
 * with a filter and a sort. A verse search asks the server which Names' written forms occur there (a lexical match, said so).
 */
export function Gallery({ names, locale }: { names: NameListItem[]; locale: string }) {
  const s = asmaStrings(locale);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("order");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [verseSlugs, setVerseSlugs] = useState<Set<string> | null>(null);

  const verse = useMemo(() => parseVerseQuery(query), [query]);
  useEffect(() => {
    if (!verse) {
      setVerseSlugs(null);
      return;
    }
    const ctl = new AbortController();
    fetch(`/api/asma/verse?surah=${verse.surah}&ayah=${verse.ayah}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Array<{ slug: string }>) => setVerseSlugs(new Set(rows.map((x) => x.slug))))
      .catch(() => undefined);
    return () => ctl.abort();
  }, [verse]);

  const shown = useMemo(() => sortAndFilter(names, { query, sort, filter, verseSlugs: verse ? verseSlugs ?? new Set<string>() : null }), [names, query, sort, filter, verse, verseSlugs]);

  return (
    <section aria-labelledby="as-gallery-h" className="as-sections">
      <h2 id="as-gallery-h" className="zq-eyebrow">
        {s.gallery.heading}
      </h2>
      <div className="as-controls">
        <div className="as-field">
          <label htmlFor="as-search">{s.gallery.searchLabel}</label>
          <input id="as-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={s.gallery.searchPlaceholder} aria-describedby="as-search-help" autoComplete="off" enterKeyHint="search" />
        </div>
        <div className="as-field">
          <label htmlFor="as-filter">{s.gallery.filterLabel}</label>
          <select id="as-filter" value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)}>
            {(["all", "withExact", "noExact"] as const).map((k) => (
              <option key={k} value={k}>
                {s.gallery.filters[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="as-field">
          <label htmlFor="as-sort">{s.gallery.sortLabel}</label>
          <select id="as-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {(["order", "alpha", "exact"] as const).map((k) => (
              <option key={k} value={k}>
                {s.gallery.sort[k]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p id="as-search-help" className="as-note">
        {s.gallery.searchHelp} {verse ? s.gallery.verseHelp : null}
      </p>
      <p role="status" aria-live="polite" className="zq-meta" data-testid="gallery-count">
        {s.gallery.results(shown.length)}
      </p>
      {shown.length === 0 ? (
        <p>
          {s.gallery.none}{" "}
          <button type="button" className="zq-btn zq-btn-quiet" onClick={() => setQuery("")}>
            {s.gallery.clear}
          </button>
        </p>
      ) : (
        <ul className="as-grid" data-testid="names-grid">
          {shown.map((n) => (
            <li key={n.slug}>
              <Link href={`/asma/${n.slug}`} className="as-name" data-slug={n.slug}>
                <span className="as-ar" lang="ar" dir="rtl">
                  {n.vowelled}
                </span>
                <span className="as-tr" dir="ltr">
                  {n.transliteration}
                </span>
                <span className="as-meaning">{pick(n.rendering, locale)}</span>
                <span className="as-meta">
                  <span>
                    {s.gallery.exactShort}: <span dir="ltr">{n.summary?.measures.A ? exactCount(n) : "—"}</span>
                  </span>
                  {isAiDraft(n) ? <AiDraftBadge locale={locale} /> : <AiDraftBadge locale={locale} reviewed />}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
