import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Learn Quranic Arabic",
  description: "Short lessons on the words of the Quran: roots, forms and meaning in context. Lessons appear once their word data is licensed and reviewed.",
};

const PARTS: Array<[string, string]> = [
  ["Short lessons", "A few words from a passage you are reading, one idea at a time."],
  ["Word cards", "Arabic spelling, transliteration, root, form and the meaning in this verse, kept apart from the root meaning."],
  ["Flashcards and review", "Tap to reveal and mark known or not yet. No drag-and-drop is needed, and there are no points or streaks."],
  ["Mini quizzes", "Each answer shows the verse it comes from."],
  ["Continue learning", "Your saved words and progress, kept in your account when you sign in."],
];

export default async function LearnPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: "Learn Quranic Arabic" }]}
      title="Learn Quranic Arabic"
      lead="Understand the words of the Quran: their roots, their forms and what they mean in each verse."
    >
      <div className="zq-pagebody">
        <EmptyState label={<EvidenceLabel kind="unknown">Not yet available</EvidenceLabel>} title="No lessons are published yet.">
          <p>
            Lessons are built from a word-by-word Quranic corpus (roots, lemmas, grammar). That data needs a cleared licence, and each
            lesson is checked by a reviewer before it appears. Until then nothing here is guessed or generated.
          </p>
        </EmptyState>
        <section aria-labelledby="learn-what" className="pp-sec">
          <h2 id="learn-what">What the lessons will contain</h2>
          <ul className="qb-grid" style={{ marginTop: 12 }}>
            {PARTS.map(([t, d]) => (
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
          Meanwhile, read the Arabic in the <Link href="/quran">Quran reader</Link>, where text size can be changed for each reader.
        </p>
      </div>
    </ReadingPage>
  );
}
