import type { Metadata } from "next";
import { ChapterNav } from "@/components/story/ChapterNav";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findStop, journeyStops, getJourney } from "@/content/journey";
import { englishContent } from "@/lib/i18n/locales";
import { prophetStrings } from "@/lib/i18n/modules/prophets";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { ayahArabic, quranSource } from "@/content/quran";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { BookmarkButton } from "@/components/account/BookmarkButton";
import { CopyCitationButton, ShareButton } from "@/components/account/ShareButtons";
import { DiscussionPreview } from "@/components/community/DiscussionPreview";
import { ShifaRelated } from "@/components/shifa/Related";
import { NoteEditor } from "@/components/account/NoteEditor";
import { AiDraftStory } from "@/components/drafts/AiDraftStory";
import { StoryView } from "@/components/story/StoryView";
import { getStory } from "@/lib/data/story";
import { getLinkedStories } from "@/lib/data/story-links";
import { StoryChapterLinks } from "@/components/story/StoryChapterLinks";
import { getPlayerBundle } from "@/lib/data/player";
import { StoryPlayerSection } from "@/components/player/StoryPlayerSection";
import { CitationChip, DraftBadge, EraTag, EvidenceLabel } from "@/components/ui/evidence";
import { VerseCard } from "@/components/ui/cards";
import { EmptyState, MapLegend } from "@/components/ui/misc";
import { Rosette } from "@/components/ui/icons";
import { parseAyahRange, quranHref } from "@/lib/refs";
import { publicEnv } from "@/lib/env";
import { LOCALES } from "@/lib/i18n";
import { QuranAttribution } from "@/components/quran/QuranAttribution";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => journeyStops().map((s) => ({ locale, id: s.id })));
}
export const dynamicParams = false;
/** Published profiles come from the database; refresh the static page every 5 minutes. */
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const pos = findStop(id);
  if (!pos) return {};
  return { title: pos.item.name, description: pos.item.summary, alternates: { canonical: `/prophets/${id}` } };
}

export default async function ProphetPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const pos = findStop(id);
  if (!pos) notFound();
  const { item: p, prev, next, era, eraIndex, indexInEra, index, total } = pos;
  const journey = getJourney();
  const ms = p.type === "milestone";
  const firstPassage = p.surahs?.[0]?.passages[0] ?? p.refs?.find((r) => r.kind === "quran")?.ref.replace(/^Q\s*/, "");
  const firstRange = firstPassage ? parseAyahRange(firstPassage) : null;
  const opening = firstRange ? ayahArabic(firstRange.surah, firstRange.from) : null;
  const src = quranSource();
  const t = prophetStrings(locale);
  const u = uiStrings(locale);
  const en = englishContent(locale);
  const place = p.place ?? { name: t.unknownPlace, certainty: "unknown" as const };
  const named = p.surahs?.find((s) => s.named);
  const hon = (x?: { honorific: string }) => (x?.honorific ? ` ${x.honorific}` : "");
  const story = ms ? null : await getStory({ person: p.id });
  const player = ms ? null : await getPlayerBundle({ person: p.id });
  const linked = ms ? [] : await getLinkedStories({ person: p.id });

  return (
    <ReadingPage locale={locale} crumbs={[{ href: "/prophets", label: t.title }, { label: p.name }]}>
      <header className="pp-head">
        <Rosette points={p.points ?? 8} className="pp-mark" />
        <div>
          <div className="pp-kick">
            <span className="pp-chap" data-testid="chapter-position">
              {t.position(ms ? t.milestone : t.chapter, index + 1, total)}
            </span>
            <EraTag {...p.era} />
            <DraftBadge status={journey.status} />
          </div>
          <h1 className="pp-h1">
            <span {...en}>{p.name}</span>{" "}
            {p.honorific ? (
              <small lang="ar">{p.honorific}</small>
            ) : null}
          </h1>
          <p className="pp-ar" lang="ar" dir="rtl">
            {p.arabicName}
          </p>
          {p.subtitle ? (
            <p className="pp-sub" {...en}>
              {p.subtitle}
            </p>
          ) : null}
        </div>
        <div className="pp-meta">
          {(p.evidence ?? ["quran"]).map((k) => (
            <EvidenceLabel key={k} kind={k} />
          ))}
          {named ? (
            <CitationChip kind={t.surah} href={`/quran/${named.number}`}>
              {`${named.number} ${named.name}`}
            </CitationChip>
          ) : null}
          {firstPassage ? <CitationChip href={quranHref(firstPassage)}>{`Q ${firstPassage}`}</CitationChip> : null}
          <EvidenceLabel kind={place.certainty === "point" ? "scholar" : place.certainty === "unknown" ? "unknown" : place.certainty === "disputed" ? "disputed" : "estimate"}>
            {place.name}
          </EvidenceLabel>
        </div>
        <div className="pp-acts">
          {named ? (
            <Link className="zq-btn zq-btn-primary zq-btn-link" href={`/quran/${named.number}`}>
              {t.readSurah(named.name)}
            </Link>
          ) : firstRange ? (
            <Link className="zq-btn zq-btn-primary zq-btn-link" href={`/quran/${firstRange.surah}#ayah-${firstRange.from}`}>
              {t.readAyat}
            </Link>
          ) : null}
          <BookmarkButton target={{ type: "journey_stop", id: p.id }} />
          <CopyCitationButton text={`QITL — ${p.name}. ${publicEnv.siteUrl}/prophets/${p.id}`} />
          <ShareButton title={`${p.name} — QITL`} path={`/prophets/${p.id}`} />
          {!ms ? (
            <Link className="zq-btn zq-btn-secondary zq-btn-link" href={`/life-through-ages/prophets/${p.id}`} data-testid="life-times-tab">
              {t.lifeTimes}
            </Link>
          ) : null}
        </div>
      </header>

      <nav className="pp-pos" aria-label={t.journeyPosition}>
        {prev ? (
          <Link href={`/prophets/${prev.id}`}>
            <span>
              <span className="zq-arrow" aria-hidden="true">
                {t.prevArrow}
              </span>{" "}
              {t.previous}
            </span>
            <b {...en}>
              {prev.name}
              <span lang="ar">{hon(prev)}</span>
            </b>
          </Link>
        ) : (
          <span />
        )}
        <div className="pp-era">
          {String(eraIndex + 1).padStart(2, "0")} / <span {...en}>{era.title}</span> · {t.ofCount(indexInEra + 1, era.items.length)}
        </div>
        {next ? (
          <Link href={`/prophets/${next.id}`} className="nx">
            <span>
              {t.next}{" "}
              <span className="zq-arrow" aria-hidden="true">
                {t.nextArrow}
              </span>
            </span>
            <b {...en}>
              {next.name}
              <span lang="ar">{hon(next)}</span>
            </b>
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <div className="pp-grid">
        <div>
          <nav className="pp-toc" aria-label={t.onThisPage}>
            {!ms ? <a href="#full-story">{t.toc.fullStory}</a> : null}
            <a href="#story">{t.toc.story}</a>
            <a href="#quran">{t.toc.quran}</a>
            <a href="#hadith">{t.toc.hadith}</a>
            <a href="#places">{t.toc.places}</a>
            <a href="#discuss">{t.toc.discuss}</a>
          </nav>
          <ChapterNav
            storageKey={`prophet:${p.id}`}
            chapters={[
              { id: "full-story", label: t.chapters.fullStory },
              { id: "story", label: t.chapters.outline },
              { id: "quran", label: t.chapters.quran },
              { id: "hadith", label: t.chapters.hadith },
              { id: "places", label: t.chapters.places },
              { id: "discuss", label: t.chapters.discuss },
            ]}
          />

          {player?.scripts.length ? <StoryPlayerSection bundle={player} locale={locale} /> : null}

          {story ? (
            <section className="pp-sec" id="full-story" aria-labelledby="full-story-h">
              <h2 id="full-story-h">{t.fullStory}</h2>
              <p className="lead">{t.fullStoryLead}</p>
              {story.state === "ok" && story.story ? (
                <StoryView
                  story={story.story}
                  name={p.name}
                  intro={
                    p.surahs?.length ? (
                      <p className="qs-hadith-refs">
                        <span className="qp-fact-label">{t.quranChapters}</span>
                        {p.surahs.map((su) => (
                          <CitationChip key={su.number} kind={t.surah} href={`/quran/${su.number}`}>{`${su.number} ${su.name}`}</CitationChip>
                        ))}
                      </p>
                    ) : null
                  }
                />
              ) : (
                <AiDraftStory
                  slug={p.id}
                  locale={locale}
                  fallback={
                    <EmptyState
                      tone={story.state === "not_configured" ? "soon" : "unknown"}
                      label={<EvidenceLabel kind="unknown">{t.notWritten}</EvidenceLabel>}
                      title={story.state === "error" ? t.storyError : t.storyPending(p.name)}
                    >
                      <p>{t.storyPendingBody}</p>
                    </EmptyState>
                  }
                />
              )}
            </section>
          ) : null}
          <StoryChapterLinks stories={linked} locale={locale} />

          <section className="pp-sec" id="story" aria-labelledby="story-h">
            <h2 id="story-h">{p.story?.length ? t.outlineIn(p.story.length) : t.outline}</h2>
            <p className="lead" {...en}>
              {p.summary}
            </p>
            {p.story?.length ? (
              <ol className="pp-steps" data-testid="story-steps">
                {p.story.map((s) => (
                  <li key={s.title} className="pp-step">
                    <h3 {...en}>{s.title}</h3>
                    {s.summary ? <p {...en}>{s.summary}</p> : <p className="zq-meta">{t.summaryDrafting}</p>}
                    <div className="row">
                      <EvidenceLabel kind="quran" />
                      <CitationChip href={quranHref(s.ayat)}>{`Q ${s.ayat}`}</CitationChip>
                      <Link className="zq-iconbtn" href={quranHref(s.ayat) ?? "/quran"}>
                        {t.readAyatShort}{" "}
                        <span className="zq-arrow" aria-hidden="true">
                          {t.nextArrow}
                        </span>
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState label={<EvidenceLabel kind="unknown">{t.outlineMissing}</EvidenceLabel>} title={t.outlineMissingTitle}>
                <p>{t.outlineMissingBody}</p>
              </EmptyState>
            )}
          </section>

          <section className="pp-sec" id="quran" aria-labelledby="quran-h">
            <h2 id="quran-h">{t.fromQuran}</h2>
            <p className="lead">
              {firstPassage ? t.openingAyah(`Q ${firstPassage}`) : t.noPassage} {t.arabicNote}
            </p>
            {firstRange ? (
              <VerseCard
                surahName={p.surahs?.[0]?.name ?? `${t.surah} ${firstRange.surah}`}
                reference={`Q ${firstRange.surah}:${firstRange.from}`}
                arabic={opening}
                licence="pending"
                actions={{ bookmark: { type: "quran_verse", id: `${firstRange.surah}:${firstRange.from}` }, sourceHref: `/quran/${firstRange.surah}#ayah-${firstRange.from}` }}
              />
            ) : null}
            <QuranAttribution src={src} />
          </section>

          <section className="pp-sec" id="hadith" aria-labelledby="hadith-h">
            <h2 id="hadith-h">{t.fromSunnah}</h2>
            <EmptyState label={<EvidenceLabel kind="unknown">{t.notAttached}</EvidenceLabel>} title={t.noNarration}>
              <p>
                {locale === "ur" ? (
                  <>
                    <span {...en}>{p.name}</span>
                    <span lang="ar">{hon(p)}</span> {t.narrationsAbout}
                  </>
                ) : (
                  <>
                    {t.narrationsAbout} <span {...en}>{p.name}</span>
                    <span lang="ar">{hon(p)}</span>
                  </>
                )}{" "}
                {t.narrationsBody}
              </p>
            </EmptyState>
          </section>

          <section className="pp-sec" id="places" aria-labelledby="places-h">
            <h2 id="places-h">{t.places}</h2>
            <p className="lead">
              {u.place[place.certainty]}: <span {...en}>{place.name}</span>. {place.certainty === "unknown" ? t.notPlaced : t.exactSites}
            </p>
            <AtlasPreview name={place.name} certainty={place.certainty} locale={locale} />
          </section>

          {ms ? null : <ShifaRelated locale={locale} personSlug={p.id} />}

          <section className="pp-sec" id="discuss" aria-labelledby="discuss-h">
            <h2 id="discuss-h">{t.discussion}</h2>
            <p className="lead">{t.discussionLead}</p>
            <DiscussionPreview contentType="journey_stop" contentId={p.id} />
          </section>
        </div>

        <aside className="pp-side" aria-label={t.about(p.name)}>
          {p.surahs?.length ? (
            <div className="pp-card">
              <h3>{t.relatedSurahs}</h3>
              <ul className="pp-sur">
                {p.surahs.map((s) => (
                  <li key={`${s.number}-${s.passages.join()}`}>
                    <span className="n">{s.number}</span>
                    <span className="t">
                      <b {...en}>{s.name}</b>{" "}
                      <span lang="ar" dir="rtl">
                        {s.arabic}
                      </span>
                    </span>
                    <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {s.passages.map((ps) => (
                        <CitationChip key={ps} href={quranHref(ps)}>{`Q ${ps}`}</CitationChip>
                      ))}
                      {s.named ? <span className="zq-jc-named">{t.namedAfterHim}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="pp-card">
              <h3>{t.sources}</h3>
              <ul className="zq-jc-refs">
                {(p.refs ?? []).map((r) => (
                  <li key={r.ref + r.label}>
                    <CitationChip kind={r.kind === "quran" ? t.refKinds.quran : r.kind === "hadith" ? t.refKinds.hadith : t.refKinds.scholar} href={r.kind === "quran" ? quranHref(r.ref.replace(/^Q\s*/, "")) : undefined}>
                      {r.ref}
                    </CitationChip>
                    <span {...en}>{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!ms ? (
            <div className="pp-card">
              <h3>{t.family}</h3>
              {/* Family edges come only from reviewed relationship claims (genealogy explorer); none are reviewed yet. */}
              <p className="zq-meta" style={{ margin: 0 }}>
                {t.familyNone} <Link href={`/genealogy?focus=${p.id}`}>{t.openGenealogy}</Link>
              </p>
            </div>
          ) : null}
          <NoteEditor target={{ type: "journey_stop", id: p.id }} />
          <div className="pp-card">
            <h3>{t.onTheJourney}</h3>
            <EraTag {...p.era} />
            <p className="zq-meta" style={{ margin: 0 }}>
              {u.era[p.era.certainty]}. {era.note ? <span {...en}>{era.note}</span> : null}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href={`/#${p.id}`}>
                {t.seeOnJourney}
              </Link>
              <Link className="zq-btn zq-btn-quiet zq-btn-sm zq-btn-link" href={`/timeline?selected=${p.id}`}>
                {t.onTimeline}
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </ReadingPage>
  );
}

/** Static atlas preview. Regions are hatched; unknown places get a "?" ring and are never placed. */
function AtlasPreview({ name, certainty, locale }: { name: string; certainty: "point" | "region" | "hypothesis" | "disputed" | "unknown"; locale: string }) {
  const t = prophetStrings(locale);
  const PLACE_TEXT = uiStrings(locale).place;
  return (
    <div className="pp-map">
      <svg className="base" viewBox="0 0 800 260" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${PLACE_TEXT[certainty]}: ${name}`}>
        <defs>
          <pattern id="hz" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={2} height={6} fill="var(--slate)" opacity={0.6} />
          </pattern>
        </defs>
        <path d="M0 0H800V260H0Z" fill="var(--surface-sunken)" />
        {certainty === "region" || certainty === "disputed" ? (
          <>
            <path d="M250 40 C330 30 420 60 470 110 C500 150 470 210 400 230 C320 250 250 220 220 170 C195 120 200 60 250 40Z" fill="var(--map-region)" opacity={0.55} />
            <path d="M250 40 C330 30 420 60 470 110 C500 150 470 210 400 230 C320 250 250 220 220 170 C195 120 200 60 250 40Z" fill="url(#hz)" stroke={certainty === "disputed" ? "var(--ev-disputed)" : "var(--slate)"} strokeWidth={certainty === "disputed" ? 3 : 1.5} />
          </>
        ) : null}
        {certainty === "hypothesis" ? (
          <path d="M250 40 C330 30 420 60 470 110 C500 150 470 210 400 230 C320 250 250 220 220 170 C195 120 200 60 250 40Z" fill="none" stroke="var(--map-hypothesis)" strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" />
        ) : null}
        {certainty === "point" ? <circle cx={340} cy={130} r={8} fill="var(--map-point)" stroke="var(--surface-raised)" strokeWidth={3} /> : null}
        {/* Unknown places are never drawn on the map; they are listed beside it. */}
        {certainty !== "unknown" ? (
          <text x={340} y={160} textAnchor="middle" fill="var(--ink)" style={{ font: "600 14px var(--font-sans)" }}>
            {name.length > 48 ? `${name.slice(0, 46)}…` : name}
          </text>
        ) : null}
      </svg>
      <span className="note">{t.schematicNote}</span>
      {certainty === "unknown" ? (
        <ul className="pp-map-unknown" aria-label={t.notMapped}>
          <li>
            <span className="pp-q" aria-hidden="true">
              ?
            </span>{" "}
            {name} — {t.locationUnknown}
          </li>
        </ul>
      ) : null}
      <MapLegend items={certainty === "point" ? ["point", "unknown"] : certainty === "hypothesis" ? ["hypothesis", "unknown"] : ["region", "unknown"]} attribution={t.schematicAttribution} />
    </div>
  );
}
