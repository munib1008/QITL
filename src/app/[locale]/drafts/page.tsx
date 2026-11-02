import type { Metadata } from "next";
import Link from "next/link";
import { DraftBanner } from "@/components/drafts/DraftBanner";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { englishContent } from "@/lib/i18n/locales";
import { draftPreviewStrings } from "@/lib/i18n/modules/draftPreview";
import { publicAiDraftGate } from "@/lib/stories/ai-draft-gate";
import { DRAFT_INDEX, NOINDEX } from "@/lib/stories/draft-data";
import { SUBJECT_TYPES, groupByType, parseSubjectType, type PreviewStory } from "@/lib/stories/draft-preview";
import "@/styles/draft-preview.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = draftPreviewStrings((await params).locale);
  return { title: `${t.listTitle} · ${t.draftWord}`, description: t.listMeta, robots: NOINDEX };
}

const norm = (s: string) => s.toLocaleLowerCase("en").normalize("NFKD").replace(/\p{M}/gu, "");

/**
 * The list of story drafts, grouped by type, with counts, a type filter (?type=) and an optional search (?q=). Drafts are
 * unreviewed AI-written text: this section is deliberately separate from /stories and carries the draft banner.
 */
export default async function DraftsIndex({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ type?: string; q?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = draftPreviewStrings(locale);
  const en = englishContent(locale);
  const type = parseSubjectType(sp.type);
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const nq = norm(q);
  const matches = (s: PreviewStory) => !nq || norm(`${s.title_en} ${s.slug}`).includes(nq) || (!!s.title_ar && s.title_ar.includes(q));
  const gate = await publicAiDraftGate();
  const visible = DRAFT_INDEX.stories.filter((s) => (!gate || gate.has(s.slug)) && matches(s));
  const groups = groupByType(visible).filter((g) => !type || g.type === type);
  const href = (ty: string | null) => {
    const p = new URLSearchParams();
    if (ty) p.set("type", ty);
    if (q) p.set("q", q);
    const s = p.toString();
    return `/drafts${s ? `?${s}` : ""}`;
  };

  return (
    <ReadingPage locale={locale} crumbs={[{ label: t.listTitle }]} title={t.listTitle} lead={t.listLead}>
      <div className="zq-pagebody">
        <DraftBanner locale={locale} />

        <nav aria-label={t.filterLabel}>
          <ul className="dp-filters" data-testid="draft-filters">
            <li>
              <Link href={href(null)} aria-current={!type ? "true" : undefined}>
                {t.all} <span className="zq-meta">({visible.length})</span>
              </Link>
            </li>
            {SUBJECT_TYPES.map((ty) => (
              <li key={ty}>
                <Link href={href(ty)} aria-current={type === ty ? "true" : undefined} data-type={ty}>
                  {t.types[ty]![0]} <span className="zq-meta">({visible.filter((s) => s.type === ty).length})</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <form className="dp-search" role="search" action="/drafts" method="get">
          <label>
            {t.search}
            <input type="search" name="q" defaultValue={q} placeholder={t.searchPlaceholder} maxLength={80} autoComplete="off" />
          </label>
          {type ? <input type="hidden" name="type" value={type} /> : null}
          <button type="submit" className="zq-btn zq-btn-secondary">
            {t.searchButton}
          </button>
          {q || type ? (
            <Link className="zq-btn zq-btn-quiet" href="/drafts">
              {t.clear}
            </Link>
          ) : null}
        </form>

        {groups.every((g) => g.stories.length === 0) ? (
          <EmptyState title={t.none}>
            <p>{type && !q ? t.noneOfType : t.none}</p>
          </EmptyState>
        ) : (
          groups
            .filter((g) => g.stories.length > 0 || !!type)
            .map((g) => (
              <section key={g.type} className="dp-group" aria-labelledby={`g-${g.type}`} data-testid={`group-${g.type}`}>
                <h2 id={`g-${g.type}`} className="zq-eyebrow">
                  {t.types[g.type]![0]} · {t.count(g.stories.length)}
                </h2>
                {g.stories.length ? (
                  <ul className="dp-grid">
                    {g.stories.map((s) => (
                      <li key={s.slug}>
                        <Link href={`/drafts/${s.slug}`} className="dp-card" data-testid="draft-card">
                          <span className="zq-eyebrow">
                            {t.draftWord} · {t.reviewPending}
                          </span>
                          <h3 {...en}>{s.title_en}</h3>
                          {s.title_ar ? (
                            <span lang="ar" dir="rtl" className="dp-ar">
                              {s.title_ar}
                            </span>
                          ) : null}
                          <span className="zq-meta">
                            {t.types[s.type]![1]} · {t.chaptersCount(s.chapters.length)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="zq-meta">{t.noneOfType}</p>
                )}
              </section>
            ))
        )}
      </div>
    </ReadingPage>
  );
}
