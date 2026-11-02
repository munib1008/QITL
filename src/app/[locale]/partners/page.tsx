import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { NotConfigured } from "@/components/mufti/states";
import { PaymentsNotice, Pill, ScopeNotices, languageName, regionName } from "@/components/partners/shared";
import { getPublicSupabase } from "@/lib/supabase/server";
import { partnersT } from "@/lib/i18n/modules/partners";
import { directoryHref, filterDirectory, paginate, parseDirectoryQuery } from "@/lib/partners/directory";
import { loadCategories, loadDirectory } from "@/lib/partners/queries";
import { categoryName, groupByTrack } from "@/lib/partners/taxonomy";
import { LANGUAGE_CODES } from "@/lib/partners/constants";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = partnersT((await params).locale);
  return { title: t.title, description: t.lead };
}
export const dynamic = "force-dynamic";

/**
 * The directory of approved Learning Partners: search and filters (a plain GET form, so it works without scripts), a list
 * view, and no private addresses (the directory view carries city and country only). Without a database it shows a designed
 * "not connected" state and no providers.
 */
export default async function PartnersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = partnersT(locale);
  const page = (body: React.ReactNode) => (
    <ReadingPage locale={locale} crumbs={[{ label: t.crumb }]} title={t.title} lead={t.lead}>
      <div className="zq-pagebody pt">{body}</div>
    </ReadingPage>
  );
  const sb = getPublicSupabase();
  if (!sb)
    return page(
      <>
        <NotConfigured locale={locale} title={t.notConnected} body={t.notConnectedBody} />
        <PaymentsNotice t={t} />
        <ScopeNotices t={t} />
      </>,
    );

  const filters = parseDirectoryQuery(sp);
  const [{ rows, error }, categories] = await Promise.all([loadDirectory(sb), loadCategories(sb)]);
  const matched = filterDirectory(rows, filters);
  const pg = paginate(matched);
  const countries = [...new Set(rows.map((r) => r.country))].sort();
  const langs = LANGUAGE_CODES.filter((c) => rows.some((r) => r.languages.includes(c) || r.teaching_languages.includes(c)));
  const groups = groupByTrack(categories);
  const catName = new Map(categories.map((c) => [c.id, categoryName(c, locale)]));
  const f = t.directory.filters;
  const opt = (v: string, label: string) => (
    <option key={v} value={v}>
      {label}
    </option>
  );

  return page(
    <>
      <PaymentsNotice t={t} />
      <form method="get" action="/partners" className="pt-filters-box" role="search" aria-label={t.directory.filtersTitle} data-testid="directory-filters">
        <div className="zq-field">
          <label htmlFor="pt-q">{t.directory.searchLabel}</label>
          <input id="pt-q" name="q" type="search" className="zq-input" defaultValue={filters.q ?? ""} maxLength={80} placeholder={t.directory.searchPlaceholder} />
        </div>
        <div className="pt-filters">
          <div className="zq-field">
            <label htmlFor="pt-category">{f.category}</label>
            <select id="pt-category" name="category" className="zq-input" defaultValue={filters.category ?? ""}>
              <option value="">{t.directory.any}</option>
              {groups.map((g) => (
                <optgroup key={g.track} label={t.tracks[g.track]}>
                  {g.items.map((c) => opt(c.id, categoryName(c, locale)))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="zq-field">
            <label htmlFor="pt-country">{f.country}</label>
            <select id="pt-country" name="country" className="zq-input" defaultValue={filters.country ?? ""}>
              <option value="">{t.directory.any}</option>
              {countries.map((c) => opt(c, regionName(c, locale)))}
            </select>
          </div>
          <div className="zq-field">
            <label htmlFor="pt-city">{f.city}</label>
            <input id="pt-city" name="city" className="zq-input" defaultValue={filters.city ?? ""} maxLength={80} />
          </div>
          <div className="zq-field">
            <label htmlFor="pt-mode">{f.mode}</label>
            <select id="pt-mode" name="mode" className="zq-input" defaultValue={filters.mode ?? ""}>
              <option value="">{t.directory.any}</option>
              {(["online", "in_person", "hybrid"] as const).map((m) => opt(m, t.modes[m]!))}
            </select>
          </div>
          <div className="zq-field">
            <label htmlFor="pt-language">{f.language}</label>
            <select id="pt-language" name="language" className="zq-input" defaultValue={filters.language ?? ""}>
              <option value="">{t.directory.any}</option>
              {langs.map((c) => opt(c, languageName(c, locale)))}
            </select>
          </div>
          <div className="zq-field">
            <label htmlFor="pt-price">{f.price}</label>
            <select id="pt-price" name="price" className="zq-input" defaultValue={filters.price ?? ""}>
              <option value="">{t.directory.any}</option>
              {opt("free", t.directory.price.free)}
              {opt("paid", t.directory.price.paid)}
            </select>
          </div>
          <div className="zq-field">
            <label htmlFor="pt-level">{f.level}</label>
            <select id="pt-level" name="level" className="zq-input" defaultValue={filters.level ?? ""}>
              <option value="">{t.directory.any}</option>
              {(["beginner", "intermediate", "advanced", "all_levels"] as const).map((l) => opt(l, t.levels[l]!))}
            </select>
          </div>
          <div className="zq-field">
            <label htmlFor="pt-group">{f.group}</label>
            <select id="pt-group" name="group" className="zq-input" defaultValue={filters.group ?? ""}>
              <option value="">{t.directory.any}</option>
              {opt("individual", t.groupTypes.individual!)}
              {opt("group", t.groupTypes.group!)}
            </select>
          </div>
        </div>
        <div className="pt-actions">
          <button type="submit" className="zq-btn zq-btn-primary">
            {t.directory.apply}
          </button>
          <Link className="zq-btn" href="/partners">
            {t.directory.clear}
          </Link>
        </div>
      </form>

      <section className="pt-sec" aria-labelledby="pt-results-h">
        <h2 id="pt-results-h" aria-live="polite">
          {t.directory.results(matched.length)}
        </h2>
        {error ? (
          <p className="zq-error" role="alert">
            {t.loadError}
          </p>
        ) : !pg.items.length ? (
          <div className="pt-card" data-testid="directory-empty">
            <h3>{t.directory.none}</h3>
            <p>{t.directory.noneBody}</p>
          </div>
        ) : (
          <ul className="pt-grid" data-testid="directory-list">
            {pg.items.map((r) => (
              <li key={r.id} className="pt-card" data-testid="directory-card">
                <Link className="title" href={`/partners/${r.slug}`}>
                  {r.display_name}
                </Link>
                <div className="pt-meta">
                  <span>{t.providerTypes[r.provider_type]}</span>
                  <span>{[r.city, regionName(r.country, locale)].filter(Boolean).join(", ")}</span>
                  <span>{t.directory.services(r.service_count)}</span>
                </div>
                {r.short_description ? <p>{r.short_description}</p> : null}
                <div className="pt-pills">
                  {r.modes.map((m) => (
                    <Pill key={m}>{t.modes[m]}</Pill>
                  ))}
                  {r.has_free ? <Pill>{t.pricing.types.free}</Pill> : null}
                  {r.category_ids.slice(0, 3).map((c) => (
                    <Pill key={c}>{catName.get(c)}</Pill>
                  ))}
                </div>
                <p className="pt-claim">{t.provider.statedBy}</p>
              </li>
            ))}
          </ul>
        )}
        {pg.pages > 1 ? (
          <nav className="pt-pager" aria-label={t.directory.page(pg.page, pg.pages)}>
            {pg.page > 1 ? (
              <Link className="zq-btn" href={directoryHref({ ...filters, page: pg.page - 1 })} rel="prev">
                {t.directory.prev}
              </Link>
            ) : (
              <span />
            )}
            <span>{t.directory.page(pg.page, pg.pages)}</span>
            {pg.page < pg.pages ? (
              <Link className="zq-btn" href={directoryHref({ ...filters, page: pg.page + 1 })} rel="next">
                {t.directory.next}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>

      <section className="pt-card" aria-labelledby="pt-register-h">
        <h3 id="pt-register-h">{t.directory.registerTitle}</h3>
        <p>{t.directory.registerBody}</p>
        <div className="pt-actions">
          <Link className="zq-btn zq-btn-primary" href="/partners/register">
            {t.directory.registerCta}
          </Link>
          <Link className="zq-btn" href="/partners/dashboard">
            {t.directory.dashboard}
          </Link>
          <Link className="zq-btn" href="/partners/inquiries">
            {t.directory.myInquiries}
          </Link>
        </div>
      </section>
      <ScopeNotices t={t} />
    </>,
  );
}
