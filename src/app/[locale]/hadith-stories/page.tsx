import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { CountsNote, StoryCard } from "@/components/encyclopedia/Encyclopedia";
import { EmptyState } from "@/components/ui/misc";
import { publishedStories, storyCounts } from "@/lib/data/hadithStories";
import { filterOptions, filterStories, hasFilters, parseFilters } from "@/lib/encyclopedia/model";
import { getDict } from "@/lib/i18n";
import { hadithStoryStrings } from "@/lib/i18n/modules/hadithStories";
import { fill } from "@/lib/i18n/modules/search";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = hadithStoryStrings((await params).locale);
  return { title: s.title, description: s.lead };
}

export default async function HadithStoriesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const t = hadithStoryStrings(locale);
  const filters = parseFilters(await searchParams);
  const [all, counts] = await Promise.all([publishedStories(), storyCounts()]);
  const options = all ? filterOptions(all) : null;
  const shown = all ? filterStories(all, filters) : [];
  const f = t.filters;
  return (
    <ReadingPage locale={raw} crumbs={[{ label: t.crumb }]} kicker={t.kicker} title={t.title} lead={t.lead}>
      <div className="zq-pagebody he-page">
        <section className="he-rules" aria-labelledby="he-rules-h">
          <h2 id="he-rules-h">{t.rules.heading}</h2>
          <ul>
            {t.rules.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
        {all?.length && options ? (
          <>
            <form className="he-filters" method="get" action="/hadith-stories" aria-label={f.label} data-testid="story-filters">
              <label>
                {f.theme}
                <select name="theme" defaultValue={filters.theme ?? ""}>
                  <option value="">{f.any}</option>
                  {options.themes.map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {locale === "ar" && o.title_ar ? o.title_ar : o.title_en}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {f.narrator}
                <select name="narrator" defaultValue={filters.narrator ?? ""}>
                  <option value="">{f.any}</option>
                  {options.narrators.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {f.person}
                <select name="person" defaultValue={filters.person ?? ""}>
                  <option value="">{f.any}</option>
                  {options.people.map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {locale === "ar" && o.name_ar ? o.name_ar : o.name_en}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {f.community}
                <select name="community" defaultValue={filters.community ?? ""}>
                  <option value="">{f.any}</option>
                  {options.communities.map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {locale === "ar" && o.name_ar ? o.name_ar : o.name_en}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {f.kind}
                <select name="kind" defaultValue={filters.kind ?? ""}>
                  <option value="">{f.any}</option>
                  {options.kinds.map((k) => (
                    <option key={k} value={k}>
                      {t.kinds[k]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="he-filter-actions">
                <button type="submit" className="zq-btn zq-btn-primary">
                  {f.apply}
                </button>
                {hasFilters(filters) ? (
                  <Link className="zq-btn zq-btn-secondary" href="/hadith-stories">
                    {f.clear}
                  </Link>
                ) : null}
              </div>
            </form>
            <p className="zq-meta" role="status" data-testid="story-count">
              {fill(shown.length === 1 ? t.count.one : t.count.many, { n: shown.length })}
            </p>
            {shown.length ? (
              <ul className="he-grid" data-testid="story-grid">
                {shown.map((s) => (
                  <StoryCard key={s.slug} s={s} locale={locale} t={t} />
                ))}
              </ul>
            ) : (
              <EmptyState title={t.empty.noMatch}>
                <Link href="/hadith-stories">{f.clear}</Link>
              </EmptyState>
            )}
          </>
        ) : (
          <EmptyState title={all ? t.empty.title : t.empty.notConnected}>
            <p>{t.empty.body}</p>
            {all ? <CountsNote counts={counts} labels={t.empty} /> : null}
            <p>
              <Link href="/hadith">{t.empty.browse}</Link>
            </p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
