import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { learnStrings } from "@/lib/i18n/modules/search";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = learnStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

export default async function LearnPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const s = learnStrings(locale);
  return (
    <ReadingPage locale={locale} crumbs={[{ label: s.title }]} title={s.title} lead={s.lead}>
      <div className="zq-pagebody">
        <EmptyState label={<EvidenceLabel kind="unknown">{s.notAvailable}</EvidenceLabel>} title={s.noLessons}>
          <p>{s.noLessonsBody}</p>
        </EmptyState>
        <section aria-labelledby="learn-what" className="pp-sec">
          <h2 id="learn-what">{s.what}</h2>
          <ul className="qb-grid" style={{ marginTop: 12 }}>
            {s.parts.map(([t, d]) => (
              <li key={t}>
                <span className="qb-soon">
                  <b>{t}</b>
                  <small>{d}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <p className="zq-meta">
          {s.meanwhile} <Link href="/quran">{s.reader}</Link>
          {s.meanwhileEnd}
        </p>
      </div>
    </ReadingPage>
  );
}
