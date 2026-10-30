import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { HadithCard } from "@/components/ui/cards";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { DiscussionPreview } from "@/components/community/DiscussionPreview";
import { AUTHENTIC_GRADES, collectionById, presentedAsSahih } from "@/lib/data/hadith";
import { getServerSupabase } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ collection: string; number: string }> }): Promise<Metadata> {
  const { collection, number } = await params;
  const c = collectionById(collection);
  return c ? { title: `${c.name} ${number}` } : {};
}

interface Grading {
  grader: string;
  grade: string;
  grade_label: string;
  citation: string;
}
interface Entry {
  id: string;
  numbering_system: string;
  canonical_number: string;
  arabic: string;
  hadith_translations: Array<{ translator: string; text: string }>;
  hadith_gradings: Grading[];
}

export default async function HadithPage({ params }: { params: Promise<{ locale: string; collection: string; number: string }> }) {
  const { locale, collection, number } = await params;
  const c = collectionById(collection);
  if (!c || !/^[0-9]+[a-z]?$/.test(number)) notFound();
  const sb = await getServerSupabase();
  const entries: Entry[] | null = sb
    ? ((
        await sb
          .from("hadith_entries")
          .select("id, numbering_system, canonical_number, arabic, hadith_translations(translator, text), hadith_gradings(grader, grade, grade_label, citation)")
          .eq("collection_id", c.id)
          .eq("canonical_number", number)
          .eq("status", "published")
      ).data as Entry[] | null)
    : null;

  return (
    <ReadingPage locale={locale} crumbs={[{ href: "/hadith", label: "Hadith" }, { href: `/hadith/${c.id}`, label: c.name }, { label: number }]} title={`${c.name} ${number}`}>
      <div className="zq-pagebody">
        {entries?.length ? (
          entries.map((e) => {
            const grades = new Set(e.hadith_gradings.map((g) => g.grade));
            const varies = grades.size > 1;
            const t = e.hadith_translations[0];
            return (
              <div key={e.id} style={{ display: "grid", gap: 16 }}>
                <HadithCard
                  collection={c.name}
                  number={`${c.name.replace(/^Sahih |^Sunan |^Jami' /, "")} ${e.canonical_number}`}
                  numbering={e.numbering_system}
                  arabic={e.arabic}
                  translation={t?.text}
                  gradings={e.hadith_gradings.map((g) => ({ grade: g.grade_label, grader: g.grader, source: g.citation, authentic: AUTHENTIC_GRADES.has(g.grade), varies }))}
                  actions={{ bookmark: { type: "hadith", id: `${c.id}:${e.canonical_number}` } }}
                />
                {!c.sahihCollection ? (
                  <p className="zq-meta" data-sahih-presentation={presentedAsSahih(c.id, e.hadith_gradings) ? "sahih" : "not-sahih"}>
                    {presentedAsSahih(c.id, e.hadith_gradings)
                      ? "Presented as sahih because a named scholar's recorded grading of this narration says so."
                      : `Not presented as sahih: no recorded grading of this narration says sahih. Being in ${c.name} is not a grade.`}
                  </p>
                ) : null}
                {t ? <p className="zq-licence">Translation: {t.translator}</p> : <p className="zq-licence zq-licence-pending">Translation unavailable — licence pending</p>}
                {varies ? (
                  <section className="pp-card" aria-labelledby={`dis-${e.id}`}>
                    <h3 id={`dis-${e.id}`}>Scholars differ on this narration</h3>
                    <ul className="zq-gradings">
                      {e.hadith_gradings.map((g) => (
                        <li key={g.grader}>
                          <b>{g.grader}</b>: {g.grade_label} — <span className="zq-meta">{g.citation}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            );
          })
        ) : (
          <EmptyState label={<EvidenceLabel kind="unknown">Not published</EvidenceLabel>} title={`${c.name} ${number} is not published on QITL yet.`}>
            <p>{sb ? "No reviewed record exists for this number in this collection." : "The hadith database is not connected on this site yet."} No text is shown rather than an unverified one.</p>
          </EmptyState>
        )}
        <section aria-labelledby="disc-h">
          <h2 id="disc-h" className="zq-eyebrow">
            Discussion
          </h2>
          <DiscussionPreview contentType="hadith" contentId={`${c.id}:${number}`} />
        </section>
      </div>
    </ReadingPage>
  );
}
