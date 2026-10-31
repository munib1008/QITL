import type { Metadata } from "next";
import Link from "next/link";
import { journeyStops } from "@/content/journey";
import { quranSource, quranStructure, surahList } from "@/content/quran";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { ContinueReading } from "@/components/quran/ContinueReading";
import { JumpToAyah } from "@/components/quran/JumpToAyah";
import { SurahIndex } from "@/components/quran/SurahIndex";

export const metadata: Metadata = { title: "Quran", description: "The 114 surahs, with the Arabic from a verified source and translations shown only where licensed." };

export default async function QuranIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const list = surahList();
  const src = quranSource();
  // Without the import, show the surahs the journey cites (names as written in the journey content).
  const cited = new Map<number, { name: string; arabic: string }>();
  for (const s of journeyStops()) for (const su of s.surahs ?? []) if (!cited.has(su.number)) cited.set(su.number, { name: su.name, arabic: su.arabic });

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: "Quran" }]}
      title="Quran"
      lead="Arabic first, from a verified source pinned by version and checksum. Translations appear beside it only when their licence is cleared."
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
            <EmptyState label={<EvidenceLabel kind="unknown">Source not imported</EvidenceLabel>} title="The verified Quran text has not been imported on this site yet.">
              <p>The Arabic is never typed in by hand. It is imported from a verified source (Tanzil), pinned by version and checksum, with scripts/import-quran.ts. Until then the reader cannot show the text.</p>
            </EmptyState>
            <section aria-labelledby="cited-h">
              <h2 id="cited-h" className="zq-eyebrow">
                Surahs cited on the journey
              </h2>
              <ol className="zq-surahs">
                {[...cited.entries()]
                  .sort((a, b) => a[0] - b[0])
                  .map(([n, s]) => (
                    <li key={n}>
                      <Link href={`/quran/${n}`}>
                        <span className="zq-order">{n}</span>
                        <b>{s.name}</b>
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
