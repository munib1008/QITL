import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { EvidenceLabel } from "@/components/ui/evidence";
import { KidsMode } from "@/components/creation/KidsMode";
import { CreationVisual } from "@/components/creation/CreationVisual";
import { CategoryCards, ComparisonTable, RelationshipGraph, SourcePanel, StoryLibrary } from "@/components/creation/atlas";
import { MisconceptionExplorer, type MisconceptionItem } from "@/components/creation/MisconceptionExplorer";
import { Dual } from "@/components/creation/parts";
import { atlasRefs, getAtlas, type Atlas } from "@/lib/data/creation";
import { creationStrings } from "@/lib/i18n/modules/creation";
import { CreationDraftIndex } from "@/components/sourced/CreationDraftIndex";
import { draftPreviewStrings } from "@/lib/i18n/modules/draftPreview";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = creationStrings((await params).locale);
  return { title: t.title, description: t.lead };
}

const EMPTY: Atlas = { profiles: [], relationships: [], stories: [], visuals: [] };

export default async function CreationHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  // Content language for names (Arabic or English rows); interface strings follow the interface language (en, ar, ur).
  const locale = raw === "ar" ? "ar" : "en";
  const t = creationStrings(raw);
  const res = await getAtlas();
  const atlas = res.state === "ok" ? res.atlas : EMPTY;
  const misconceptions: MisconceptionItem[] = atlas.profiles.flatMap((p) =>
    p.entries
      .filter((e) => e.kind === "misconception")
      .sort((a, b) => a.position - b.position)
      .map((entry) => ({ entry, categoryId: p.categoryId, profileSlug: p.slug, profileName: locale === "ar" ? p.nameAr : p.nameEn })),
  );
  const sections = [
    ["cr-categories", t.sections.categories],
    ["cr-compare", t.sections.compare],
    ["cr-graph", t.sections.graph],
    ["cr-stories", t.sections.stories],
    ["cr-know", t.sections.misconceptions],
    ["cr-sources-h", t.sections.sources],
  ] as const;

  return (
    <ReadingPage
      locale={raw}
      crumbs={[{ label: t.title }]}
      title={
        <>
          {t.title}
          {locale === "en" ? (
            <>
              {" "}
              <small lang="ar" dir="rtl" className="cr-h1-ar">
                {t.titleAr}
              </small>
            </>
          ) : null}
        </>
      }
      lead={t.lead}
    >
      <KidsMode label={t.kids.label} onText={t.kids.on}>
        <div className="zq-pagebody cr-body">
          {res.state !== "ok" ? (
            <EmptyState tone={res.state === "not_configured" ? "soon" : "unknown"} label={<span className="zq-soon">{t.evidence.not_established}</span>} title={res.state === "error" ? t.empty.error : t.empty.notConfigured}>
              <p>{t.empty.notConfiguredBody}</p>
            </EmptyState>
          ) : null}

          <section className="cr-intro" aria-labelledby="cr-intro-h">
            <div>
              <h2 id="cr-intro-h">{t.intro.heading}</h2>
              <div className="cr-adult-only">
                {t.intro.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              <p className="cr-kids-only">{t.intro.kids}</p>
              {res.state === "ok" && !atlas.profiles.length ? (
                <EmptyState label={<EvidenceLabel kind="unknown">{t.evidence.not_established}</EvidenceLabel>} title={t.empty.nothingPublished}>
                  <p>{t.empty.nothingPublishedBody}</p>
                </EmptyState>
              ) : null}
            </div>
            <CreationVisual animation="orbits" alt={t.intro.visualCaption} caption={t.intro.visualCaption} strings={t.visual} decorative />
          </section>

          <nav className="cr-jump" aria-label={t.jump}>
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="zq-pill">
                {label}
              </a>
            ))}
          </nav>

          <section className="cr-sec" aria-labelledby="cr-categories">
            <h2 id="cr-categories">{t.sections.categories}</h2>
            <CategoryCards profiles={atlas.profiles} t={t} locale={locale} />
          </section>

          <section className="cr-sec" aria-labelledby="cr-compare">
            <h2 id="cr-compare">{t.sections.compare}</h2>
            <p className="zq-meta">{t.compare.help}</p>
            <ComparisonTable profiles={atlas.profiles} t={t} locale={locale} />
          </section>

          <section className="cr-sec" aria-labelledby="cr-graph">
            <h2 id="cr-graph">{t.sections.graph}</h2>
            <p className="zq-meta">{t.graph.help}</p>
            <RelationshipGraph relationships={atlas.relationships} profiles={atlas.profiles} t={t} locale={locale} />
          </section>

          <section className="cr-sec" aria-labelledby="cr-stories">
            <h2 id="cr-stories">{t.sections.stories}</h2>
            <p className="zq-meta">{t.stories.help}</p>
            <StoryLibrary stories={atlas.stories} profiles={atlas.profiles} t={t} locale={locale} />
          </section>

          <section className="cr-sec" aria-labelledby="cr-know">
            <h2 id="cr-know">
              <Dual normal={t.sections.misconceptions} />
            </h2>
            <p className="zq-meta">{t.misconceptions.help}</p>
            <MisconceptionExplorer items={misconceptions} locale={locale} />
          </section>

          <CreationDraftIndex locale={locale} heading={draftPreviewStrings(raw).listTitle} />

          <SourcePanel refs={atlasRefs(atlas)} t={t} />
        </div>
      </KidsMode>
    </ReadingPage>
  );
}
