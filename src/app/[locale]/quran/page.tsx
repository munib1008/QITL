import type { Metadata } from "next";
import Link from "next/link";
import { journeyStops } from "@/content/journey";
import { quranSource, quranStructure, surahList } from "@/content/quran";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { englishContent } from "@/lib/i18n/locales";
import { quranPageStrings } from "@/lib/i18n/modules/reader";
import { ContinueReading } from "@/components/quran/ContinueReading";
import { JumpToAyah } from "@/components/quran/JumpToAyah";
import { SurahIndex } from "@/components/quran/SurahIndex";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = quranPageStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

export default async function QuranIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = quranPageStrings(locale);
  const en = englishContent(locale);
  const list = surahList();
  const src = quranSource();
  // Without the import, show the surahs the journey cites (names as written in the journey content).
  const cited = new Map<number, { name: string; arabic: string }>();
  for (const s of journeyStops()) for (const su of s.surahs ?? []) if (!cited.has(su.number)) cited.set(su.number, { name: su.name, arabic: su.arabic });

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: t.title }]}
      title={t.title}
      lead={t.lead}
      meta={<EvidenceLabel kind="quran" />}
    >
      <div className="zq-pagebody">
        {list ? (
          <>
            <ContinueReading names={Object.fromEntries(list.map((x) => [x.number, x.name]))} locale={locale} more={2} />
            <JumpToAyah surahs={list.map((x) => ({ number: x.number, name: x.name, ayahs: x.ayahs }))} locale={locale} />
            <SurahIndex
              surahs={list.map((x) => ({ number: x.number, name: x.name, arabic: x.arabic, english: x.english, ayahs: x.ayahs }))}
              juz={quranStructure()?.juz ?? null}
              locale={locale}
            />
            <QuranAttribution src={src} />
          </>
        ) : (
          <>
            <EmptyState label={<EvidenceLabel kind="unknown">{t.sourceNotImported}</EvidenceLabel>} title={t.notImported}>
              <p>{t.notImportedBody}</p>
            </EmptyState>
            <section aria-labelledby="cited-h">
              <h2 id="cited-h" className="zq-eyebrow">
                {t.cited}
              </h2>
              <ol className="zq-surahs">
                {[...cited.entries()]
                  .sort((a, b) => a[0] - b[0])
                  .map(([n, s]) => (
                    <li key={n}>
                      <Link href={`/quran/${n}`}>
                        <span className="zq-order">{n}</span>
                        <b {...en}>{s.name}</b>
                        <span lang="ar" dir="rtl" className="zq-jc-sar">
                          {s.arabic}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </ReadingPage>
  );
}
