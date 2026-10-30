import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { journeyStops } from "@/content/journey";
import { quranSource, surahArabic, surahList } from "@/content/quran";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { AyahReader } from "@/components/quran/AyahReader";
import { StudyLauncher } from "@/components/quran/StudyLauncher";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { parseAyahRange } from "@/lib/refs";
import { LOCALES } from "@/lib/i18n";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => Array.from({ length: 114 }, (_, i) => ({ locale, surah: String(i + 1) })));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ surah: string }> }): Promise<Metadata> {
  const { surah } = await params;
  const meta = surahList()?.[Number(surah) - 1];
  return { title: meta ? `Surah ${meta.name}` : `Surah ${surah}` };
}

export default async function SurahPage({ params }: { params: Promise<{ locale: string; surah: string }> }) {
  const { locale, surah } = await params;
  const n = Number(surah);
  if (!Number.isInteger(n) || n < 1 || n > 114) notFound();
  const meta = surahList()?.[n - 1];
  const verses = surahArabic(n);
  const src = quranSource();

  // Journey stops whose passages fall in this surah: the "related events" of each ayah.
  const related = journeyStops()
    .map((s) => ({ s, passages: (s.surahs ?? []).filter((x) => x.number === n).flatMap((x) => x.passages) }))
    .filter((r) => r.passages.length);
  const name = meta?.name ?? journeyStops().flatMap((s) => s.surahs ?? []).find((x) => x.number === n)?.name ?? `Surah ${n}`;
  const ayahLinks: Record<number, Array<{ id: string; name: string }>> = {};
  for (const r of related)
    for (const p of r.passages) {
      const rg = parseAyahRange(p);
      if (!rg) continue;
      for (let a = rg.from; a <= rg.to; a++) (ayahLinks[a] ??= []).push({ id: r.s.id, name: r.s.name });
    }

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ href: "/quran", label: "Quran" }, { label: name }]}
      kicker={<span className="pp-chap">Surah {n}</span>}
      title={
        <>
          {name}{" "}
          {meta ? (
            <small lang="ar" dir="rtl" style={{ font: "400 28px/1 var(--font-naskh)", color: "var(--ink-muted)" }}>
              {meta.arabic}
            </small>
          ) : null}
        </>
      }
      lead={meta ? `${meta.ayahs} ayat${meta.revelation ? ` · ${meta.revelation}` : ""}` : undefined}
      meta={
        <>
          <EvidenceLabel kind="quran" />
          <span className="zq-licence zq-licence-pending">Translation unavailable — licence pending</span>
        </>
      }
    >
      <div className="zq-pagebody">
        {related.length ? (
          <section aria-labelledby="rel-h" className="pp-card">
            <h2 id="rel-h">On the journey</h2>
            <ul className="zq-jc-refs">
              {related.map((r) => (
                <li key={r.s.id}>
                  <Link href={`/prophets/${r.s.id}`}>{r.s.name}</Link>
                  {r.passages.map((p) => (
                    <CitationChip key={p} href={`#ayah-${parseAyahRange(p)?.from ?? 1}`}>{`Q ${p}`}</CitationChip>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {verses ? (
          <>
            <AyahReader surah={n} surahName={name} verses={verses} links={ayahLinks} locale={locale} />
            <p className="zq-meta">
              Arabic text: {src?.source}, version {src?.version}. {src?.license}
            </p>
          </>
        ) : (
          <>
            <EmptyState label={<EvidenceLabel kind="unknown">Source not imported</EvidenceLabel>} title="The Arabic of this surah is not loaded yet.">
              <p>It is shown only from the verified source import, never typed in. Tafsir and translations appear here once licensed and reviewed.</p>
            </EmptyState>
            <StudyLauncher surah={n} maxAyah={meta?.ayahs ?? null} related={ayahLinks} locale={locale} />
          </>
        )}
        <nav className="qr-surahnav" aria-label="Surah navigation">
          {n > 1 ? (
            <Link className="zq-btn zq-btn-secondary zq-btn-link" href={`/quran/${n - 1}`} rel="prev">
              ← Surah {n - 1}
              {surahList()?.[n - 2] ? ` · ${surahList()![n - 2]!.name}` : ""}
            </Link>
          ) : (
            <span />
          )}
          <Link className="zq-btn zq-btn-quiet zq-btn-link" href="/quran">
            All surahs
          </Link>
          {n < 114 ? (
            <Link className="zq-btn zq-btn-secondary zq-btn-link" href={`/quran/${n + 1}`} rel="next">
              Surah {n + 1}
              {surahList()?.[n] ? ` · ${surahList()![n]!.name}` : ""} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
        <section aria-labelledby="tafsir-h">
          <h2 id="tafsir-h" className="zq-eyebrow">
            Tafsir
          </h2>
          <EmptyState label={<EvidenceLabel kind="scholar">Not yet attached</EvidenceLabel>} title="No tafsir is attached to this surah yet.">
            <p>Each tafsir excerpt names its scholar and work, and appears only when its licence is cleared.</p>
          </EmptyState>
        </section>
      </div>
    </ReadingPage>
  );
}
