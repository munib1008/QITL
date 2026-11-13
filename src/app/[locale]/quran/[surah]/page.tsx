import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { journeyStops } from "@/content/journey";
import { quranSource, quranStructure, surahArabic, surahList } from "@/content/quran";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { AyahReader } from "@/components/quran/AyahReader";
import { StudyLauncher } from "@/components/quran/StudyLauncher";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { LanguageNote } from "@/components/i18n/LanguageNote";
import { parseAyahRange, ayahHash } from "@/lib/refs";
import { LOCALES } from "@/lib/i18n";
import { englishContent } from "@/lib/i18n/locales";
import { quranPageStrings } from "@/lib/i18n/modules/reader";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { RiwayahIndicator } from "@/components/qiraat/RiwayahIndicator";
import { JumpToAyah } from "@/components/quran/JumpToAyah";
import { quranReaderStrings } from "@/lib/i18n/modules/quranReader";
import { attributionLine, markersForSurah } from "@/lib/quran-reader";
import { asmaConfirmedInSurah } from "@/lib/data/asma";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import { draftsCitingSurah } from "@/lib/stories/draft-related";
import { citersOfSurah } from "@/lib/graph/verse-graph";
import { graphStrings } from "@/lib/i18n/modules/graph";
import { publicAiDraftGate } from "@/lib/stories/ai-draft-gate";
import { draftPreviewStrings } from "@/lib/i18n/modules/draftPreview";

// Revalidated so the "Explore this Name" links follow reviewer decisions without a rebuild.
export const revalidate = 300;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => Array.from({ length: 114 }, (_, i) => ({ locale, surah: String(i + 1) })));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; surah: string }> }): Promise<Metadata> {
  const { locale, surah } = await params;
  const meta = surahList()?.[Number(surah) - 1];
  return { title: quranPageStrings(locale).surah(meta ? meta.name : surah) };
}

export default async function SurahPage({ params }: { params: Promise<{ locale: string; surah: string }> }) {
  const { locale, surah } = await params;
  const n = Number(surah);
  if (!Number.isInteger(n) || n < 1 || n > 114) notFound();
  const t = quranPageStrings(locale);
  const en = englishContent(locale);
  const meta = surahList()?.[n - 1];
  const verses = surahArabic(n);
  const src = quranSource();
  const structure = quranStructure();
  const markers = structure ? markersForSurah(structure, n) : {};
  const all = surahList();

  // Journey stops whose passages fall in this surah: the "related events" of each ayah.
  const related = journeyStops()
    .map((s) => ({ s, passages: (s.surahs ?? []).filter((x) => x.number === n).flatMap((x) => x.passages) }))
    .filter((r) => r.passages.length);
  const name = meta?.name ?? journeyStops().flatMap((s) => s.surahs ?? []).find((x) => x.number === n)?.name ?? t.surah(n);
  const ayahLinks: Record<number, Array<{ id: string; name: string; href?: string; lang?: string }>> = {};
  for (const r of related)
    for (const p of r.passages) {
      const rg = parseAyahRange(p);
      if (!rg) continue;
      for (let a = rg.from; a <= rg.to; a++) (ayahLinks[a] ??= []).push({ id: r.s.id, name: r.s.name });
    }

  // "Explore this Name": only where a scholarly reviewer confirmed that the word refers to Allah in that ayah (never a lexical match alone).
  const asmaLinks = await asmaConfirmedInSurah(n);
  for (const [ayah, list] of Object.entries(asmaLinks))
    for (const x of list) (ayahLinks[Number(ayah)] ??= []).push({ id: `asma-${x.slug}`, name: `${asmaStrings(locale).reader.exploreName}: ${x.ar}`, href: `/asma/${x.slug}` });
  // Related knowledge: the public story drafts whose chapters cite this ayah (at most three per ayah, each links to the labelled draft).
  const gate = await publicAiDraftGate();
  for (const [ayah, list] of draftsCitingSurah(n, gate ? new Set(gate.keys()) : null))
    for (const d of list.slice(0, 3)) (ayahLinks[ayah] ??= []).push({ id: `draft-${d.slug}`, name: `${d.title} (${draftPreviewStrings(locale).draftWord})`, href: `/drafts/${d.slug}`, lang: "en" });
  // Creation Atlas, Life Guidance and How They Lived pages that cite this ayah (a pointer to read more, never a claim they agree).
  const gk = graphStrings(locale).kinds;
  for (const [ayah, list] of citersOfSurah(n)) for (const c of list) (ayahLinks[ayah] ??= []).push({ id: `${c.kind}-${c.slug}`, name: `${c.title} (${gk[c.kind]})`, href: c.href, lang: "en" });
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ href: "/quran", label: t.title }, { label: name }]}
      kicker={<span className="pp-chap">{t.surah(n)}</span>}
      title={
        <>
          <span {...en}>{name}</span>{" "}
          {meta ? (
            <small lang="ar" dir="rtl" style={{ font: "400 28px/1 var(--font-naskh)", color: "var(--ink-muted)" }}>
              {meta.arabic}
            </small>
          ) : null}
        </>
      }
      lead={meta ? `${t.ayat(meta.ayahs)}${meta.revelation ? ` · ${meta.revelation}` : ""}` : undefined}
      meta={
        <>
          <EvidenceLabel kind="quran" />
          <span className="zq-licence zq-licence-pending">{t.translationPending}</span>
        </>
      }
    >
      <div className="zq-pagebody">
        <LanguageNote kind="quran" />
        {all ? <JumpToAyah surahs={all.map((s) => ({ number: s.number, name: s.name, ayahs: s.ayahs }))} current={n} locale={locale} /> : null}
        {/* Audio stays honest: the Qira'at module shows a player only for an approved recording of this riwayah. */}
        <RiwayahIndicator locale={locale} surah={n} />
        {related.length ? (
          <section aria-labelledby="rel-h" className="pp-card">
            <h2 id="rel-h">{t.onJourney}</h2>
            <ul className="zq-jc-refs" {...en}>
              {related.map((r) => (
                <li key={r.s.id}>
                  <Link href={`/prophets/${r.s.id}`}>{r.s.name}</Link>
                  {r.passages.map((p) => (
                    <CitationChip key={p} href={ayahHash(parseAyahRange(p)?.from ?? 1, parseAyahRange(p)?.to)}>{`Q ${p}`}</CitationChip>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {verses ? (
          <>
            <AyahReader surah={n} surahName={name} verses={verses} links={ayahLinks} locale={locale} markers={markers} attribution={src ? attributionLine(src) : ""} />
            <QuranAttribution src={src} />
            {structure ? <p className="zq-meta">{quranReaderStrings(locale).index.juzSource}</p> : null}
          </>
        ) : (
          <>
            <EmptyState label={<EvidenceLabel kind="unknown">{t.sourceNotImported}</EvidenceLabel>} title={t.surahNotLoaded}>
              <p>{t.surahNotLoadedBody}</p>
            </EmptyState>
            <StudyLauncher surah={n} maxAyah={meta?.ayahs ?? null} related={Object.fromEntries(Object.entries(ayahLinks).map(([a, l]) => [a, l.filter((x) => !x.href)]))} locale={locale} />
          </>
        )}
        <nav className="qr-surahnav" aria-label={t.surahNav}>
          {n > 1 ? (
            <Link className="zq-btn zq-btn-secondary zq-btn-link" href={`/quran/${n - 1}`} rel="prev">
              {t.prev} {t.surah(n - 1)}
              {surahList()?.[n - 2] ? ` · ${surahList()![n - 2]!.name}` : ""}
            </Link>
          ) : (
            <span />
          )}
          <Link className="zq-btn zq-btn-quiet zq-btn-link" href="/quran">
            {t.allSurahs}
          </Link>
          {n < 114 ? (
            <Link className="zq-btn zq-btn-secondary zq-btn-link" href={`/quran/${n + 1}`} rel="next">
              {t.surah(n + 1)}
              {surahList()?.[n] ? ` · ${surahList()![n]!.name}` : ""} {t.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
        <section aria-labelledby="tafsir-h">
          <h2 id="tafsir-h" className="zq-eyebrow">
            {t.tafsir}
          </h2>
          <EmptyState label={<EvidenceLabel kind="scholar">{t.notAttached}</EvidenceLabel>} title={t.noTafsir}>
            <p>{t.noTafsirBody}</p>
          </EmptyState>
        </section>
      </div>
    </ReadingPage>
  );
}
