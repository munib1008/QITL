import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { DemoTag } from "@/components/ui/evidence";
import { Gallery } from "@/components/asma/Gallery";
import { Learn } from "@/components/asma/Learn";
import { AiDraftBanner, MeasureCards, Provenance, Section, Unavailable } from "@/components/asma/Parts";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import { highlightWord, type CountSummary, type NameListItem } from "@/lib/asma/model";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Asma' test fixture", robots: { index: false, follow: false } };

const SUMMARY: CountSummary = {
  methodology: "fixture-v1",
  normalisation: "asma-norm-v1",
  tokenisation: "asma-tok-v1",
  queryVersion: "asma-query-v1",
  edition: { source: "Fixture text (not the Quran)", version: "0", sha256: "a".repeat(64), contentSha256: "b".repeat(64) },
  measures: { A: { count: 3, verses: 2, queryHash: "c".repeat(64), stale: false }, B: { count: 0, verses: 0, queryHash: "d".repeat(64), stale: false }, C: { count: 1, verses: 1, queryHash: "e".repeat(64), stale: true } },
};
const mk = (slug: string, ar: string, tr: string, en: string, a: number): NameListItem => ({
  slug, ar, vowelled: ar, transliteration: tr, rendering: { en, ar: "معنى تجريبي", ur: "تجرباتی مفہوم" }, root: null, recognition_status: "educational_list",
  recognition_basis: "Educational list - enumeration not established by this platform", scholarly_status: "not_reviewed", ai_generated: true, published: false, needs_rereview: false,
  updated_at: "2026-01-01", summary: { ...SUMMARY, measures: { ...SUMMARY.measures, A: { ...SUMMARY.measures.A!, count: a } } },
});
const NAMES = [mk("fixture-one", "اسم", "Fixture One", "A fixture gloss", 3), mk("fixture-two", "اسمان", "Fixture Two", "Another fixture gloss", 0), mk("fixture-three", "أسماء", "Fixture Three", "A third fixture gloss", 7)];
// Placeholder letters, not Quran text; the tokens are what the highlighter marks.
const VERSE = "بسم الله الرحمن الرحيم قل هو الله احد";

/** Test harness for the Asma' al-Husna components with data in them. 404 unless QITL_E2E_FIXTURES=1. Placeholder text only. */
export default async function AsmaFixture({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.QITL_E2E_FIXTURES !== "1") notFound();
  const { locale: raw } = await params;
  const locale = raw === "ar" || raw === "ur" ? raw : "en";
  const s = asmaStrings(locale);
  return (
    <ReadingPage locale={raw} crumbs={[{ label: "Asma' test fixture" }]} title="Asma' test fixture">
      <div className="zq-pagebody as-page">
        <p>
          <DemoTag /> Test fixture with placeholder text. Not a Name, not Quran text.
        </p>
        <AiDraftBanner locale={locale} />
        <MeasureCards locale={locale} summary={SUMMARY} />
        <Provenance locale={locale} summary={SUMMARY} />
        <Gallery names={NAMES} locale={locale} />
        <Section id="fx-occ" title={s.explorer.title}>
          <ol className="as-occ" data-testid="fx-occurrences">
            <li>
              <p className="as-verse" lang="ar" dir="rtl">
                {highlightWord(112, 1, VERSE, 1).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
              </p>
              <div className="as-meta">
                <span dir="ltr">Q 112:1</span>
                <span>{s.measures.referent.unreviewed}</span>
              </div>
            </li>
          </ol>
        </Section>
        <Section id="fx-un" title={s.name.sections.F}>
          <Unavailable locale={locale} />
        </Section>
        <Learn locale={locale} names={NAMES.map((n) => ({ slug: n.slug, ar: n.vowelled, transliteration: n.transliteration, meaning: n.rendering.en ?? "" }))} />
      </div>
    </ReadingPage>
  );
}
