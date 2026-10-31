import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ayahHash } from "@/lib/refs";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { BookmarkButton } from "@/components/account/BookmarkButton";
import { DiscussionPreview } from "@/components/community/DiscussionPreview";
import { ChapterProgress } from "@/components/account/ChapterProgress";
import { NoteEditor } from "@/components/account/NoteEditor";
import { Markdown } from "@/components/ui/Markdown";
import { getServerSupabase } from "@/lib/supabase/server";
import type { EvidenceKind } from "@/content/journey";

interface Ref {
  kind: string;
  quran_surah: number | null;
  quran_ayah_from: number | null;
  quran_ayah_to: number | null;
  hadith_id: string | null;
  locator: string | null;
  sources: { work: string } | null;
}
interface Chapter {
  id: string;
  position: number;
  title: string;
  body_md: string;
  chapter_claims: Array<{ anchor: string | null; evidence_claims: { id: string; statement: string; evidence: EvidenceKind; claim_references: Ref[] } }>;
}
interface Story {
  id: string;
  slug: string;
  title: string;
  title_ar: string | null;
  summary: string;
  chapters: Chapter[];
}

function refLabel(r: Ref): { text: string; href?: string } {
  if (r.kind === "quran" && r.quran_surah)
    return {
      text: `Q ${r.quran_surah}:${r.quran_ayah_from}${r.quran_ayah_to && r.quran_ayah_to !== r.quran_ayah_from ? `–${r.quran_ayah_to}` : ""}`,
      href: `/quran/${r.quran_surah}${ayahHash(r.quran_ayah_from ?? 1, r.quran_ayah_to)}`,
    };
  return { text: `${r.sources?.work ?? r.kind}${r.locator ? `, ${r.locator}` : ""}` };
}

import { englishContent } from "@/lib/i18n/locales";
import { storiesStrings } from "@/lib/i18n/modules/prophets";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.replace(/-/g, " ") };
}

export default async function StoryPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ chapter?: string }> }) {
  const { locale, slug } = await params;
  const { chapter } = await searchParams;
  const t = storiesStrings(locale);
  const en = englishContent(locale);
  const sb = await getServerSupabase();
  if (!sb) notFound();
  const { data } = await sb
    .from("stories")
    .select(
      "id, slug, title, title_ar, summary, chapters(id, position, title, body_md, chapter_claims(anchor, evidence_claims(id, statement, evidence, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, hadith_id, locator, sources(work)))))",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .eq("chapters.status", "published")
    .order("position", { referencedTable: "chapters" })
    .maybeSingle();
  const story = data as Story | null;
  if (!story) notFound();
  const pos = Math.min(Math.max(Number(chapter ?? 1), 1), Math.max(story.chapters.length, 1));
  const ch = story.chapters[pos - 1];

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ href: "/stories", label: t.title }, { label: story.title }]}
      title={<span {...en}>{story.title}</span>}
      lead={<span {...en}>{story.summary}</span>}
      meta={<BookmarkButton target={{ type: "story", id: story.slug }} />}
    >
      <div className="pp-grid">
        <article aria-labelledby="ch-h">
          {ch ? (
            <>
              <p className="pp-chap">
                {t.chapterOf(pos, story.chapters.length)}
              </p>
              <h2 id="ch-h" style={{ font: "600 28px/36px var(--font-display)", margin: "6px 0 16px" }} {...en}>
                {ch.title}
              </h2>
              <div className="zq-prose type-reading" {...en}>
                <Markdown source={ch.body_md} />
              </div>
              <section aria-labelledby="claims-h" style={{ marginTop: 32 }}>
                <h3 id="claims-h" className="zq-eyebrow">
                  {t.evidence}
                </h3>
                <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
                  {ch.chapter_claims.map(({ evidence_claims: c }) => (
                    <li key={c.id} className="pp-card">
                      <p style={{ margin: 0 }} {...en}>
                        {c.statement}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        <EvidenceLabel kind={c.evidence} />
                        {c.claim_references.map((r, i) => {
                          const l = refLabel(r);
                          return (
                            <CitationChip key={i} href={l.href}>
                              {l.text}
                            </CitationChip>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              <ChapterProgress chapterId={ch.id} />
              <nav className="pp-pos" aria-label={t.chapters}>
                {pos > 1 ? (
                  <a href={`?chapter=${pos - 1}`}>
                    <span>{t.previous}</span>
                    <b {...en}>{story.chapters[pos - 2]!.title}</b>
                  </a>
                ) : (
                  <span />
                )}
                <div className="pp-era">
                  {pos} / {story.chapters.length}
                </div>
                {pos < story.chapters.length ? (
                  <a className="nx" href={`?chapter=${pos + 1}`}>
                    <span>{t.next}</span>
                    <b {...en}>{story.chapters[pos]!.title}</b>
                  </a>
                ) : (
                  <span />
                )}
              </nav>
            </>
          ) : (
            <p className="zq-meta">{t.noChapters}</p>
          )}
          <section className="pp-sec" id="discuss" aria-labelledby="d-h">
            <h2 id="d-h">{t.discussion}</h2>
            <DiscussionPreview contentType="story" contentId={story.slug} />
          </section>
        </article>
        <aside className="pp-side" aria-label={t.notesAndChapters}>
          <div className="pp-card">
            <h3>{t.chapters}</h3>
            <ol style={{ margin: 0, paddingInlineStart: 20 }} {...en}>
              {story.chapters.map((c) => (
                <li key={c.id}>
                  <a href={`?chapter=${c.position}`} aria-current={c.position === pos ? "page" : undefined}>
                    {c.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
          {ch ? <NoteEditor target={{ type: "chapter", id: ch.id }} /> : null}
        </aside>
      </div>
    </ReadingPage>
  );
}
