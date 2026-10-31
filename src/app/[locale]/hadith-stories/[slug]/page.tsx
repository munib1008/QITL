import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { Local, Name, NarrationCard } from "@/components/encyclopedia/Encyclopedia";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { storyBySlug } from "@/lib/data/hadithStories";
import { pick, SLUG_RE, verseHref, verseLabel } from "@/lib/encyclopedia/model";
import { getDict } from "@/lib/i18n";
import { hadithStoryStrings } from "@/lib/i18n/modules/hadithStories";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const s = hadithStoryStrings(locale);
  const story = SLUG_RE.test(slug) ? await storyBySlug(slug) : undefined;
  if (!story) return { title: s.title };
  const title = pick(story.title, locale).text ?? s.title;
  return { title, description: pick(story.summary, locale).text ?? s.lead };
}

const dirOf = (l: string) => (l === "en" ? "ltr" : "rtl");

export default async function HadithStoryPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const { locale } = getDict(raw);
  const t = hadithStoryStrings(locale);
  if (!SLUG_RE.test(slug)) notFound();
  const story = await storyBySlug(slug);
  const crumbs = [{ href: "/hadith-stories", label: t.crumb }];
  if (story === null)
    return (
      <ReadingPage locale={raw} crumbs={[...crumbs, { label: t.title }]} title={t.title}>
        <div className="zq-pagebody">
          <EmptyState title={t.empty.notConnected} />
        </div>
      </ReadingPage>
    );
  if (!story) notFound();
  const d = t.detail;
  const title = pick(story.title, locale);
  const narrator = pick(story.narrator, locale);
  const context = pick(story.context, locale);
  const lessons = story.lessons.filter((l) => l.kind === "lesson");
  const modern = story.lessons.filter((l) => l.kind === "modern_application");
  const primary = story.narrations.filter((n) => n.primary);
  const variants = story.narrations.filter((n) => !n.primary);
  return (
    <ReadingPage
      locale={raw}
      crumbs={[...crumbs, { label: title.text ?? story.slug }]}
      kicker={t.kinds[story.kind]}
      title={<Local value={story.title} locale={locale} />}
      lead={<Local value={story.summary} locale={locale} />}
      meta={
        <>
          <EvidenceLabel kind="hadith" lang={locale}>
            {d.evidence}
          </EvidenceLabel>{" "}
          <span className="zq-meta">{d.reviewed}</span>
        </>
      }
    >
      <div className="zq-pagebody he-page">
        <section className="he-sec" aria-labelledby="hs-facts-h" data-testid="story-facts">
          <h2 id="hs-facts-h">{d.story}</h2>
          <dl className="he-facts-grid">
            <dt>{d.kind}</dt>
            <dd>
              {t.kinds[story.kind]} <span className="zq-meta">· {t.kindNotes[story.kind]}</span>
            </dd>
            <dt>{d.narrator}</dt>
            <dd>
              {narrator.text ? (
                <span lang={narrator.lang} dir={dirOf(narrator.lang)}>
                  {narrator.text}
                </span>
              ) : (
                d.notEstablished
              )}
            </dd>
            <dt>{d.context}</dt>
            <dd data-testid="story-context" data-established={context.text ? "yes" : "no"}>
              {context.text ? (
                <span lang={context.lang} dir={dirOf(context.lang)}>
                  {context.text}
                </span>
              ) : (
                <>
                  <b>{d.notEstablished}</b>
                  <span className="zq-meta"> · {d.notEstablishedContext}</span>
                </>
              )}
            </dd>
          </dl>
          <p className="zq-meta">{d.summaryNote}</p>
        </section>

        <section className="he-sec" aria-labelledby="hs-narr-h">
          <h2 id="hs-narr-h">{d.narration}</h2>
          {primary.map((n) => (
            <NarrationCard key={n.id} n={n} t={t} />
          ))}
          {variants.length ? (
            <div className="he-variants" data-testid="variants">
              <h3>{d.variants}</h3>
              <p className="zq-meta">{d.variantsNote}</p>
              {variants.map((n) => (
                <NarrationCard key={n.id} n={n} t={t} />
              ))}
            </div>
          ) : null}
        </section>

        <section className="he-sec" aria-labelledby="hs-quran-h" data-testid="story-quran">
          <h2 id="hs-quran-h">{d.quran}</h2>
          {story.quran.length ? (
            <>
              <p className="zq-meta">{d.quranNote}</p>
              <ul className="he-list">
                {story.quran.map((q) => (
                  <li key={q.claimId}>
                    {q.refs.map((r) => (
                      <CitationChip key={verseLabel(r)} href={verseHref(r)}>
                        {`Q ${verseLabel(r)}`}
                      </CitationChip>
                    ))}{" "}
                    {q.statement ? (
                      <span lang="en" dir="ltr">
                        {q.statement}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="zq-meta">{d.noQuran}</p>
          )}
        </section>

        <section className="he-sec" aria-labelledby="hs-lessons-h" data-testid="story-lessons">
          <h2 id="hs-lessons-h">{d.lessons}</h2>
          {lessons.length ? (
            <>
              <p className="zq-meta">{d.lessonsNote}</p>
              {lessons.map((l) => (
                <div key={`l-${l.position}`} className="he-layer he-layer-lesson">
                  <Local value={l.body} locale={locale} as="p" />
                </div>
              ))}
            </>
          ) : (
            <p className="zq-meta">{d.noLessons}</p>
          )}
          {modern.length ? (
            <div className="he-layer he-layer-application" data-testid="modern-application">
              <h3>{d.modern}</h3>
              <p className="he-layer-label">{d.modernLabel}</p>
              {modern.map((l) => (
                <Local key={`m-${l.position}`} value={l.body} locale={locale} as="p" />
              ))}
              <p className="zq-meta">{d.modernNote}</p>
            </div>
          ) : null}
        </section>

        <section className="he-sec" aria-labelledby="hs-links-h" data-testid="story-links">
          <h2 id="hs-links-h">{d.links}</h2>
          {story.people.length || story.communities.length || story.events.length || story.themes.length ? (
            <dl className="he-facts-grid">
              {story.people.length ? (
                <>
                  <dt>{d.people}</dt>
                  <dd>
                    {story.people.map((p) => (
                      <span key={p.slug} className="he-chip-link">
                        <Link href={`/people/${p.slug}`}>
                          <Name en={p.name_en} ar={p.name_ar} locale={locale} />
                        </Link>{" "}
                      </span>
                    ))}
                  </dd>
                </>
              ) : null}
              {story.communities.length ? (
                <>
                  <dt>{d.communities}</dt>
                  <dd>
                    {story.communities.map((c) => (
                      <span key={c.slug} className="he-chip-link">
                        <Link href={`/communities/${c.slug}`}>
                          <Name en={c.name_en} ar={c.name_ar} locale={locale} />
                        </Link>{" "}
                      </span>
                    ))}
                  </dd>
                </>
              ) : null}
              {story.events.length ? (
                <>
                  <dt>{d.events}</dt>
                  <dd>
                    {story.events.map((e) => (
                      <span key={e.slug} className="he-chip-link">
                        <Link href={`/events/${e.slug}`}>
                          <Name en={e.title} ar={e.title_ar} locale={locale} />
                        </Link>{" "}
                      </span>
                    ))}
                  </dd>
                </>
              ) : null}
              {story.themes.length ? (
                <>
                  <dt>{d.themes}</dt>
                  <dd>
                    {story.themes.map((th) => (
                      <span key={th.slug} className="he-chip-link">
                        <Link href={`/hadith-stories?theme=${th.slug}`}>
                          <Name en={th.title_en} ar={th.title_ar} locale={locale} />
                        </Link>{" "}
                      </span>
                    ))}
                  </dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="zq-meta">{d.noLinks}</p>
          )}
        </section>

        <p>
          <Link className="zq-btn zq-btn-secondary zq-btn-link" href="/hadith-stories">
            {d.back}
          </Link>{" "}
          <Link className="zq-btn zq-btn-quiet zq-btn-link" href="/community/questions/ask">
            {d.askMufti}
          </Link>
        </p>
      </div>
    </ReadingPage>
  );
}
