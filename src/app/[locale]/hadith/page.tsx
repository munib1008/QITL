import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { COLLECTIONS } from "@/lib/data/hadith";
import { englishContent } from "@/lib/i18n/locales";
import { hadithStrings } from "@/lib/i18n/modules/hadith";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = hadithStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

export default async function HadithIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = hadithStrings(locale);
  const en = englishContent(locale);
  return (
    <ReadingPage locale={locale} crumbs={[{ label: t.title }]} title={t.title} lead={t.lead}>
      <div className="zq-pagebody">
        <div className="zq-grid">
          {COLLECTIONS.map((c) => (
            <Link key={c.id} href={`/hadith/${c.id}`} className="zq-card" style={{ textDecoration: "none", color: "var(--ink)", maxWidth: "none" }}>
              <p className="zq-eyebrow" {...en}>
                {c.compiler}
              </p>
              <h2 className="zq-title" style={{ fontFamily: "var(--font-display)", fontSize: 22 }} {...en}>
                {c.name}
              </h2>
              <p className="zq-prophet-ar" lang="ar" dir="rtl" style={{ margin: 0 }}>
                {c.arabic}
              </p>
              <p className="zq-meta" {...en}>
                {c.note}
              </p>
            </Link>
          ))}
        </div>
        <section className="pp-card" aria-labelledby="grading-h">
          <h3 id="grading-h">{t.gradingHeading}</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <EvidenceLabel kind="hadith">{t.gradeAuthentic}</EvidenceLabel>
            <EvidenceLabel kind="scholar">{t.gradeOther}</EvidenceLabel>
            <EvidenceLabel kind="unknown">{t.gradeNone}</EvidenceLabel>
          </div>
          <p className="zq-meta" style={{ margin: 0 }}>
            {t.gradingNote} <Link href="/methodology#hadith">{t.methodology}</Link>.
          </p>
        </section>
      </div>
    </ReadingPage>
  );
}
