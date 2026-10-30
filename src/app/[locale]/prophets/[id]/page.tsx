import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ERA_TEXT, PLACE_TEXT, findStop, journeyStops, getJourney } from "@/content/journey";
import { ayahArabic, quranSource } from "@/content/quran";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { BookmarkButton } from "@/components/account/BookmarkButton";
import { CopyCitationButton, ShareButton } from "@/components/account/ShareButtons";
import { DiscussionPreview } from "@/components/community/DiscussionPreview";
import { NoteEditor } from "@/components/account/NoteEditor";
import { CitationChip, DraftBadge, EraTag, EvidenceLabel } from "@/components/ui/evidence";
import { VerseCard } from "@/components/ui/cards";
import { EmptyState, MapLegend } from "@/components/ui/misc";
import { Rosette } from "@/components/ui/icons";
import { parseAyahRange, quranHref } from "@/lib/refs";
import { publicEnv } from "@/lib/env";
import { LOCALES } from "@/lib/i18n";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => journeyStops().map((s) => ({ locale, id: s.id })));
}
export const dynamicParams = false;

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
  const place = p.place ?? { name: "Unknown", certainty: "unknown" as const };
  const named = p.surahs?.find((s) => s.named);
  const hon = (x?: { honorific: string }) => (x?.honorific ? ` ${x.honorific}` : "");

  return (
    <ReadingPage locale={locale} crumbs={[{ href: "/prophets", label: "Prophets" }, { label: p.name }]}>
      <header className="pp-head">
        <Rosette points={p.points ?? 8} className="pp-mark" />
        <div>
          <div className="pp-kick">
            <span className="pp-chap" data-testid="chapter-position">
              {ms ? "Milestone" : "Chapter"} {index + 1} of {total}
            </span>
            <EraTag {...p.era} />
            <DraftBadge status={journey.status} />
          </div>
          <h1 className="pp-h1">
            {p.name}{" "}
            {p.honorific ? (
              <small lang="ar">{p.honorific}</small>
            ) : null}
          </h1>
          <p className="pp-ar" lang="ar" dir="rtl">
            {p.arabicName}
          </p>
          {p.subtitle ? <p className="pp-sub">{p.subtitle}</p> : null}
        </div>
        <div className="pp-meta">
          {(p.evidence ?? ["quran"]).map((k) => (
            <EvidenceLabel key={k} kind={k} />
          ))}
          {named ? (
            <CitationChip kind="Surah" href={`/quran/${named.number}`}>
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
              Read Surah {named.name}
            </Link>
          ) : firstRange ? (
            <Link className="zq-btn zq-btn-primary zq-btn-link" href={`/quran/${firstRange.surah}#ayah-${firstRange.from}`}>
              Read the ayat
            </Link>
          ) : null}
          <BookmarkButton target={{ type: "journey_stop", id: p.id }} />
          <CopyCitationButton text={`ZIQ — ${p.name}. ${publicEnv.siteUrl}/prophets/${p.id}`} />
          <ShareButton title={`${p.name} — ZIQ`} path={`/prophets/${p.id}`} />
        </div>
      </header>

      <nav className="pp-pos" aria-label="Journey position">
        {prev ? (
          <Link href={`/prophets/${prev.id}`}>
            <span><span className="zq-arrow" aria-hidden="true">←</span> Previous</span>
            <b>
              {prev.name}
              <span lang="ar">{hon(prev)}</span>
            </b>
          </Link>
        ) : (
          <span />
        )}
        <div className="pp-era">
          {String(eraIndex + 1).padStart(2, "0")} / {era.title} · {indexInEra + 1} of {era.items.length}
        </div>
        {next ? (
          <Link href={`/prophets/${next.id}`} className="nx">
            <span>Next <span className="zq-arrow" aria-hidden="true">→</span></span>
            <b>
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
          <nav className="pp-toc" aria-label="On this page">
            <a href="#story">Story</a>
            <a href="#quran">Quran</a>
            <a href="#hadith">Sunnah</a>
            <a href="#places">Places</a>
            <a href="#discuss">Discussion</a>
          </nav>

          <section className="pp-sec" id="story" aria-labelledby="story-h">
            <h2 id="story-h">{p.story?.length ? `The story in ${p.story.length} movements` : "The story"}</h2>
            <p className="lead">{p.summary}</p>
            {p.story?.length ? (
              <ol className="pp-steps" data-testid="story-steps">
                {p.story.map((s) => (
                  <li key={s.title} className="pp-step">
                    <h3>{s.title}</h3>
                    {s.summary ? <p>{s.summary}</p> : <p className="zq-meta">Summary being drafted — read the ayat below.</p>}
                    <div className="row">
                      <EvidenceLabel kind="quran" />
                      <CitationChip href={quranHref(s.ayat)}>{`Q ${s.ayat}`}</CitationChip>
                      <Link className="zq-iconbtn" href={quranHref(s.ayat) ?? "/quran"}>
                        Read ayat <span className="zq-arrow" aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState label={<EvidenceLabel kind="unknown">Outline not written yet</EvidenceLabel>} title="No story outline is attached to this page yet.">
                <p>An outline appears here only after it is written from the cited ayat and approved by the scholarly reviewers. Until then, read the passages listed under Related surahs.</p>
              </EmptyState>
            )}
          </section>

          <section className="pp-sec" id="quran" aria-labelledby="quran-h">
            <h2 id="quran-h">From the Quran</h2>
            <p className="lead">
              {firstPassage ? `The opening ayah of the first passage, ${`Q ${firstPassage}`}.` : "No passage is attached."} Arabic is loaded from the verified Quran source; translations appear once licensed.
            </p>
            {firstRange ? (
              <VerseCard
                surahName={p.surahs?.[0]?.name ?? `Surah ${firstRange.surah}`}
                reference={`Q ${firstRange.surah}:${firstRange.from}`}
                arabic={opening}
                licence="pending"
                actions={{ bookmark: { type: "quran_verse", id: `${firstRange.surah}:${firstRange.from}` }, sourceHref: `/quran/${firstRange.surah}#ayah-${firstRange.from}` }}
              />
            ) : null}
            {src ? (
              <p className="zq-meta" style={{ marginTop: 8 }}>
                Arabic text: {src.source}, version {src.version}. {src.license}
              </p>
            ) : null}
          </section>

          <section className="pp-sec" id="hadith" aria-labelledby="hadith-h">
            <h2 id="hadith-h">From the Sunnah</h2>
            <EmptyState label={<EvidenceLabel kind="unknown">Not yet attached</EvidenceLabel>} title="No narration is attached to this page yet.">
              <p>
                Narrations about {p.name}
                <span lang="ar">{hon(p)}</span> appear here only after each one is graded by a named scholar and approved by the review board.
              </p>
            </EmptyState>
          </section>

          <section className="pp-sec" id="places" aria-labelledby="places-h">
            <h2 id="places-h">Places</h2>
            <p className="lead">
              {PLACE_TEXT[place.certainty]}: {place.name}.{" "}
              {place.certainty === "unknown" ? "It is not placed on the map." : "Exact sites are shown only where a source supports them."}
            </p>
            <AtlasPreview name={place.name} certainty={place.certainty} />
          </section>

          <section className="pp-sec" id="discuss" aria-labelledby="discuss-h">
            <h2 id="discuss-h">Discussion</h2>
            <p className="lead">Reading is open to all. Sign in to ask a question or reply; every comment can cite a verse.</p>
            <DiscussionPreview contentType="journey_stop" contentId={p.id} />
          </section>
        </div>

        <aside className="pp-side" aria-label={`About ${p.name}`}>
          {p.surahs?.length ? (
            <div className="pp-card">
              <h3>Related surahs</h3>
              <ul className="pp-sur">
                {p.surahs.map((s) => (
                  <li key={`${s.number}-${s.passages.join()}`}>
                    <span className="n">{s.number}</span>
                    <span className="t">
                      <b>{s.name}</b>{" "}
                      <span lang="ar" dir="rtl">
                        {s.arabic}
                      </span>
                    </span>
                    <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {s.passages.map((ps) => (
                        <CitationChip key={ps} href={quranHref(ps)}>{`Q ${ps}`}</CitationChip>
                      ))}
                      {s.named ? <span className="zq-jc-named">Named after him</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="pp-card">
              <h3>Sources</h3>
              <ul className="zq-jc-refs">
                {(p.refs ?? []).map((r) => (
                  <li key={r.ref + r.label}>
                    <CitationChip kind={r.kind === "quran" ? "Quran" : r.kind === "hadith" ? "Hadith" : "Scholarship"} href={r.kind === "quran" ? quranHref(r.ref.replace(/^Q\s*/, "")) : undefined}>
                      {r.ref}
                    </CitationChip>
                    <span>{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!ms ? (
            <div className="pp-card">
              <h3>Family</h3>
              {/* Family edges come only from reviewed relationship claims (genealogy explorer); none are reviewed yet. */}
              <p className="zq-meta" style={{ margin: 0 }}>
                No reviewed family relationship is attached yet. Relationships appear only with a cited, reviewed claim.{" "}
                <Link href={`/genealogy?focus=${p.id}`}>Open the genealogy explorer</Link>
              </p>
            </div>
          ) : null}
          <NoteEditor target={{ type: "journey_stop", id: p.id }} />
          <div className="pp-card">
            <h3>On the journey</h3>
            <EraTag {...p.era} />
            <p className="zq-meta" style={{ margin: 0 }}>
              {ERA_TEXT[p.era.certainty]}. {era.note}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href={`/#${p.id}`}>
                See on the journey
              </Link>
              <Link className="zq-btn zq-btn-quiet zq-btn-sm zq-btn-link" href={`/timeline?selected=${p.id}`}>
                On the timeline
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </ReadingPage>
  );
}

/** Static atlas preview. Regions are hatched; unknown places get a "?" ring and are never placed. */
function AtlasPreview({ name, certainty }: { name: string; certainty: "point" | "region" | "hypothesis" | "disputed" | "unknown" }) {
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
      <span className="note">Schematic preview — not to scale; not a geographic position</span>
      {certainty === "unknown" ? (
        <ul className="pp-map-unknown" aria-label="Not mapped">
          <li>
            <span className="pp-q" aria-hidden="true">?</span> {name} — location unknown, not placed
          </li>
        </ul>
      ) : null}
      <MapLegend items={certainty === "point" ? ["point", "unknown"] : certainty === "hypothesis" ? ["hypothesis", "unknown"] : ["region", "unknown"]} attribution="Schematic drawing by ZIQ · no map data" />
    </div>
  );
}
