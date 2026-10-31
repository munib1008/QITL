import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { HadithCard } from "@/components/ui/cards";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { DiscussionPreview } from "@/components/community/DiscussionPreview";
import { AUTHENTIC_GRADES, collectionById, presentedAsSahih } from "@/lib/data/hadith";
import { getServerSupabase } from "@/lib/supabase/server";
import { englishContent } from "@/lib/i18n/locales";
import { hadithStrings } from "@/lib/i18n/modules/hadith";

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
  const s = hadithStrings(locale);
  const en = englishContent(locale);
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
    <ReadingPage locale={locale} crumbs={[{ href: "/hadith", label: s.title }, { href: `/hadith/${c.id}`, label: c.name }, { label: number }]} title={<span {...en}>{`${c.name} ${number}`}</span>}>
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
                    {presentedAsSahih(c.id, e.hadith_gradings) ? s.sahih : s.notSahih(c.name)}
                  </p>
                ) : null}
                {t ? (
                  <p className="zq-licence">
                    {s.translation} {t.translator}
                  </p>
                ) : (
                  <p className="zq-licence zq-licence-pending">{s.translationPending}</p>
                )}
                {varies ? (
                  <section className="pp-card" aria-labelledby={`dis-${e.id}`}>
                    <h3 id={`dis-${e.id}`}>{s.differ}</h3>
                    <ul className="zq-gradings" {...en}>
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
          <EmptyState label={<EvidenceLabel kind="unknown">{s.notPublished}</EvidenceLabel>} title={s.notOnQitl(`${c.name} ${number}`)}>
            <p>
              {sb ? s.noRecord : s.notConnected} {s.noText}
            </p>
          </EmptyState>
        )}
        <section aria-labelledby="disc-h">
          <h2 id="disc-h" className="zq-eyebrow">
            {s.discussion}
          </h2>
          <DiscussionPreview contentType="hadith" contentId={`${c.id}:${number}`} />
        </section>
      </div>
    </ReadingPage>
  );
}
