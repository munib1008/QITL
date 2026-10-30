import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { COLLECTIONS } from "@/lib/data/hadith";

export const metadata: Metadata = { title: "Hadith", description: "Four Sunni collections, catalogued: Sahih al-Bukhari, Sahih Muslim, Jami' at-Tirmidhi and Sunan Ibn Majah. Every narration graded on its own, by a named scholar." };

export default async function HadithIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: "Hadith" }]}
      title="Hadith"
      lead="Four Sunni collections, as a catalogue: Sahih al-Bukhari, Sahih Muslim, Jami' at-Tirmidhi and Sunan Ibn Majah. A collection is not a grade: every narration shows each recorded grading, by a named scholar, with its source — disagreements included."
    >
      <div className="zq-pagebody">
        <div className="zq-grid">
          {COLLECTIONS.map((c) => (
            <Link key={c.id} href={`/hadith/${c.id}`} className="zq-card" style={{ textDecoration: "none", color: "var(--ink)", maxWidth: "none" }}>
              <p className="zq-eyebrow">{c.compiler}</p>
              <h2 className="zq-title" style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>
                {c.name}
              </h2>
              <p className="zq-prophet-ar" lang="ar" dir="rtl" style={{ margin: 0 }}>
                {c.arabic}
              </p>
              <p className="zq-meta">{c.note}</p>
            </Link>
          ))}
        </div>
        <section className="pp-card" aria-labelledby="grading-h">
          <h3 id="grading-h">How grading is shown</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <EvidenceLabel kind="hadith">Sahih / Hasan, by a named scholar</EvidenceLabel>
            <EvidenceLabel kind="scholar">Another grade, by a named scholar</EvidenceLabel>
            <EvidenceLabel kind="unknown">Grade not recorded</EvidenceLabel>
          </div>
          <p className="zq-meta" style={{ margin: 0 }}>
            When scholars grade a narration differently, every grading is listed and the page says “Graded differently by other scholars”. See the{" "}
            <Link href="/methodology#hadith">methodology</Link>.
          </p>
        </section>
      </div>
    </ReadingPage>
  );
}
