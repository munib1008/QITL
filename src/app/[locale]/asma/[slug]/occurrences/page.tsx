import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { quranSource } from "@/content/quran";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { AiDraftBanner, isAiDraft, MeasureCards, Provenance } from "@/components/asma/Parts";
import { asmaName, asmaOccurrences } from "@/lib/data/asma";
import { getDict } from "@/lib/i18n";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import { highlightWord, quranHref, type Measure } from "@/lib/asma/model";

export const dynamic = "force-dynamic";
const PAGE = 25;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const s = asmaStrings(locale);
  return { title: `${s.explorer.title} · ${slug}`, robots: { index: false } };
}

type SP = { measure?: string; surah?: string; page?: string };

export default async function Occurrences({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SP> }) {
  const { locale: raw, slug } = await params;
  const sp = await searchParams;
  const { locale } = getDict(raw);
  const s = asmaStrings(locale);
  const x = s.explorer;
  const measure: Measure = sp.measure === "B" || sp.measure === "C" ? sp.measure : "A";
  const surah = Number.isInteger(Number(sp.surah)) && Number(sp.surah) >= 1 && Number(sp.surah) <= 114 ? Number(sp.surah) : null;
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(sp.page)) || 1));
  const n = await asmaName(slug);
  if (n === undefined) notFound();
  const shell = (children: React.ReactNode) => (
    <ReadingPage locale={raw} crumbs={[{ href: "/asma", label: s.nav }, { href: `/asma/${slug}`, label: n?.transliteration ?? slug }, { label: x.title }]} kicker={s.kicker} title={x.title} lead={x.lead}>
      <div className="zq-pagebody as-page">{children}</div>
    </ReadingPage>
  );
  if (n === null)
    return shell(
      <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.notConnected.title}</EvidenceLabel>} title={s.notConnected.title}>
        <p>{s.notConnected.body}</p>
      </EmptyState>,
    );
  const data = await asmaOccurrences(slug, measure, PAGE, (page - 1) * PAGE, surah);
  const qs = (over: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | null> = { measure, surah, page: 1, ...over };
    for (const [k, v] of Object.entries(merged)) if (v !== null && v !== undefined && !(k === "page" && v === 1)) p.set(k, String(v));
    return `?${p.toString()}`;
  };
  return shell(
    <>
      {isAiDraft(n) ? <AiDraftBanner locale={locale} status={n.scholarly_status} /> : null}
      <p className="as-note">{x.lexicalNote}</p>
      <p className="as-note">{x.dagger}</p>
      <MeasureCards locale={locale} summary={n.summary} />
      <nav className="as-tabs" aria-label={x.measureTabs} data-testid="measure-tabs">
        {(["A", "B", "C"] as const).map((k) => (
          <Link key={k} className="as-tab" href={`/asma/${slug}/occurrences${qs({ measure: k, page: 1 })}`} aria-current={k === measure ? "page" : undefined} data-measure={k}>
            {s.measures[k].name}
          </Link>
        ))}
      </nav>
      <form method="get" className="as-controls" action={`/asma/${slug}/occurrences`}>
        <input type="hidden" name="measure" value={measure} />
        <div className="as-field">
          <label htmlFor="as-surah">{x.surahFilter}</label>
          <select id="as-surah" name="surah" defaultValue={surah ?? ""}>
            <option value="">{x.allSurahs}</option>
            {Array.from({ length: 114 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
        <div className="as-field">
          <button type="submit" className="zq-btn zq-btn-secondary">
            {x.apply}
          </button>
        </div>
      </form>
      {data === null || data === undefined ? (
        <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.measures.notComputed}</EvidenceLabel>} title={x.emptyMeasure} />
      ) : data.rows.length === 0 ? (
        <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.measures[measure].name}</EvidenceLabel>} title={x.emptyMeasure} />
      ) : (
        <>
          <p role="status" className="zq-meta" data-testid="occ-total">
            {x.total(data.total)} · {x.page((page - 1) * PAGE + 1, (page - 1) * PAGE + data.rows.length)}
          </p>
          <ol className="as-occ" data-testid="occurrences" data-measure={measure} start={(page - 1) * PAGE + 1}>
            {data.rows.map((r) => (
              <li key={`${r.surah}:${r.ayah}:${r.token}`} data-referent={r.referent_status} data-relation={r.relation}>
                <p className="as-verse" lang="ar" dir="rtl">
                  {highlightWord(r.surah, r.ayah, r.text, r.token).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
                </p>
                <div className="as-meta">
                  <Link href={quranHref(r.surah, r.ayah)} dir="ltr">{`Q ${r.surah}:${r.ayah}`}</Link>
                  <span>
                    {x.word} <span dir="ltr">#{r.token}</span>
                  </span>
                  <span>{r.relation === "related" ? s.measures.related : s.measures.direct}</span>
                  {r.root ? (
                    <span lang="ar" dir="rtl">
                      {r.root}
                    </span>
                  ) : null}
                  <span>{s.measures.referent[r.referent_status]}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="as-pager">
            {page > 1 ? (
              <Link className="zq-btn zq-btn-secondary zq-btn-link" rel="prev" href={`/asma/${slug}/occurrences${qs({ page: page - 1 })}`}>
                {x.prev}
              </Link>
            ) : null}
            {page * PAGE < data.total ? (
              <Link className="zq-btn zq-btn-secondary zq-btn-link" rel="next" href={`/asma/${slug}/occurrences${qs({ page: page + 1 })}`}>
                {x.next}
              </Link>
            ) : null}
          </div>
        </>
      )}
      <Provenance locale={locale} summary={n.summary} />
      <QuranAttribution src={quranSource()} />
    </>,
  );
}
