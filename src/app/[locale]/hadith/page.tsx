import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { COLLECTIONS } from "@/lib/data/hadith";
import { englishContent } from "@/lib/i18n/locales";
import { hadithStrings } from "@/lib/i18n/modules/hadith";
import { hadithStoryStrings } from "@/lib/i18n/modules/hadithStories";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = hadithStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

export default async function HadithIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = hadithStrings(locale);
  const en = englishContent(locale);
  const hs = hadithStoryStrings(locale);
  return (
    <ReadingPage locale={locale} crumbs={[{ label: t.title }]} title={t.title} lead={t.lead}>
      <div className="qs section">
        <div className="cards four">
          {COLLECTIONS.map((c) => (
            <Link key={c.id} href={`/hadith/${c.id}`} className="card card-link">
              <p className="eyebrow" {...en}>
                {c.compiler}
              </p>
              <h2 {...en} style={{ margin: 0, font: "700 var(--q-fs-h4)/1.25 var(--font-display)" }}>
                {c.name}
              </h2>
              <span className="arabic" lang="ar" dir="rtl" style={{ fontSize: 20, color: "var(--q-text-2)", alignSelf: "flex-start" }}>
                {c.arabic}
              </span>
              <p {...en}>{c.note}</p>
            </Link>
          ))}
        </div>
        <div className="sectiontop" style={{ marginTop: "var(--space-8)" }}>
          <div>
            <h2 id="grading-h">{t.gradingHeading}</h2>
          </div>
        </div>
        <div className="rules">
          <section className="card quiet" aria-labelledby="grading-h">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <EvidenceLabel kind="hadith">{t.gradeAuthentic}</EvidenceLabel>
              <EvidenceLabel kind="scholar">{t.gradeOther}</EvidenceLabel>
              <EvidenceLabel kind="unknown">{t.gradeNone}</EvidenceLabel>
            </div>
            <p>
              {t.gradingNote} <Link href="/methodology#hadith">{t.methodology}</Link>.
            </p>
          </section>
          <section className="card quiet" aria-labelledby="hs-link-h">
            <h3 id="hs-link-h">{hs.title}</h3>
            <p>
              {hs.navNote} <Link href="/hadith-stories">{hs.nav}</Link>.
            </p>
          </section>
        </div>
      </div>
    </ReadingPage>
  );
}
