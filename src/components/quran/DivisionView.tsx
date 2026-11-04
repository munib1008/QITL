import Link from "next/link";
import { ayahArabic, quranSource, quranStructure, surahList } from "@/content/quran";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { EmptyState } from "@/components/ui/misc";
import { EvidenceLabel } from "@/components/ui/evidence";
import { englishContent } from "@/lib/i18n/locales";
import { quranPageStrings } from "@/lib/i18n/modules/reader";
import { quranDivisionStrings } from "@/lib/i18n/modules/quranDivision";
import { ayahHash } from "@/lib/refs";
import { DIVISION_COUNT, ayahPositions, divisionRange, type DivisionKind } from "@/lib/quran-division-range";

/**
 * One mushaf page or one juz as a plain, server-rendered reading view: the verbatim Tanzil Arabic of every ayah in the
 * division, grouped by surah, each ayah linking to its place in the surah reader. Boundaries come only from the imported,
 * checksum-pinned reading-division data; nothing is inferred.
 */
export function DivisionView({ kind, n, locale }: { kind: DivisionKind; n: number; locale: string }) {
  const t = quranDivisionStrings(locale);
  const q = quranPageStrings(locale);
  const en = englishContent(locale);
  const structure = quranStructure();
  const list = surahList();
  const counts = list?.map((s) => s.ayahs) ?? null;
  const max = DIVISION_COUNT[kind];
  const title = kind === "page" ? t.pageTitle(n) : t.juzTitle(n);
  const crumbs = [{ href: "/quran", label: q.title }, { label: title }];
  const range = structure && counts ? divisionRange(kind === "page" ? structure.pages : structure.juz, n, counts) : null;
  if (!range || !counts || !list) {
    return (
      <ReadingPage locale={locale} crumbs={crumbs} title={title}>
        <div className="zq-pagebody">
          <EmptyState title={t.unavailable} />
        </div>
      </ReadingPage>
    );
  }
  const positions = ayahPositions(range.from, range.to, counts);
  const groups: Array<{ surah: number; ayat: number[] }> = [];
  for (const [s, a] of positions) {
    const last = groups[groups.length - 1];
    if (last && last.surah === s) last.ayat.push(a);
    else groups.push({ surah: s, ayat: [a] });
  }
  const name = (s: number) => list[s - 1]?.name ?? q.surah(s);
  const base = `/quran/${kind}`;
  const src = quranSource();
  return (
    <ReadingPage
      locale={locale}
      crumbs={crumbs}
      title={title}
      lead={kind === "page" ? t.pageLead(n) : t.juzLead(n)}
      meta={
        <>
          <EvidenceLabel kind="quran" />
          <span className="zq-meta" {...en}>
            {t.range(`${range.from[0]}:${range.from[1]}`, `${range.to[0]}:${range.to[1]}`)}
          </span>
        </>
      }
    >
      <div className="zq-pagebody">
        <nav className="zq-row" aria-label={kind === "page" ? t.pageNav : t.juzNav} data-testid="division-nav">
          {n > 1 ? (
            <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href={`${base}/${n - 1}`} rel="prev">
              {t.previous}
            </Link>
          ) : null}
          <span className="zq-meta">
            {n} / {max}
          </span>
          {n < max ? (
            <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href={`${base}/${n + 1}`} rel="next">
              {t.next}
            </Link>
          ) : null}
        </nav>
        {groups.map((g) => (
          <section key={g.surah} aria-labelledby={`dv-${g.surah}`} className="pp-sec" data-testid="division-surah">
            <h2 id={`dv-${g.surah}`}>
              <Link href={`/quran/${g.surah}`} {...en}>
                {name(g.surah)}
              </Link>{" "}
              <small lang="ar" dir="rtl" style={{ font: "400 22px/1 var(--font-naskh)", color: "var(--ink-muted)" }}>
                {list[g.surah - 1]?.arabic}
              </small>
            </h2>
            <p lang="ar" dir="rtl" className="type-quran-inline" data-testid="division-text">
              {g.ayat.map((a) => (
                <span key={a} id={`ayah-${g.surah}-${a}`}>
                  {ayahArabic(g.surah, a)}{" "}
                  <Link href={`/quran/${g.surah}${ayahHash(a)}`} className="zq-meta" aria-label={`${name(g.surah)} ${g.surah}:${a}`}>
                    ﴿{a}﴾
                  </Link>{" "}
                </span>
              ))}
            </p>
            <p className="zq-meta">
              <Link href={`/quran/${g.surah}${ayahHash(g.ayat[0]!)}`}>{t.openSurah}</Link>
            </p>
          </section>
        ))}
        <QuranAttribution src={src} />
      </div>
    </ReadingPage>
  );
}
