import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { StoryView } from "@/components/story/StoryView";
import { DiscussionPreview } from "@/components/community/DiscussionPreview";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import type { DatePrecision } from "@/components/ui/cards";
import { englishContent } from "@/lib/i18n/locales";
import { eventStrings } from "@/lib/i18n/modules/events";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { getPublicSupabase } from "@/lib/supabase/server";
import { getStory } from "@/lib/data/story";
import { getPlayerBundle } from "@/lib/data/player";
import { StoryPlayerSection } from "@/components/player/StoryPlayerSection";
import { formatRange } from "@/lib/years";
import type { EvidenceKind } from "@/content/labels";
import { UniverseOnlyPage, UniverseSections, orderingText } from "@/components/timeline/UniverseSections";
import { redirectTarget, universeEventBySlug } from "@/lib/events/universe";
import { timelineStrings } from "@/lib/i18n/modules/timeline";

export const revalidate = 300;

interface EventRow {
  id: string;
  slug: string;
  title: string;
  title_ar: string | null;
  summary: string | null;
  date_precision: DatePrecision;
  start_year: number | null;
  end_year: number | null;
  start_ah: number | null;
  end_ah: number | null;
  evidence_claims: { evidence: EvidenceKind } | null;
  event_people: Array<{ people: { slug: string; name_en: string } | null }>;
  event_places: Array<{ locations: { slug: string; name_en: string } | null }>;
}

async function load(slug: string): Promise<EventRow | null | "not_configured"> {
  const sb = getPublicSupabase();
  if (!sb) return "not_configured";
  const { data } = await sb
    .from("historical_events")
    .select(
      "id, slug, title, title_ar, summary, date_precision, start_year, end_year, start_ah, end_ah, evidence_claims(evidence), event_people(people(slug, name_en)), event_places(locations(slug, name_en))",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .in("category", ["sacred_history", "prophetic_life", "islamic_history"])
    .maybeSingle();
  return (data as unknown as EventRow | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const p = await params;
  const e = await load(p.slug);
  return e && e !== "not_configured" ? { title: e.title, description: e.summary ?? undefined } : { title: eventStrings(p.locale).event };
}

export default async function EventPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const t = eventStrings(locale);
  const u = uiStrings(locale);
  const en = englishContent(locale);
  const [e, uv] = await Promise.all([load(slug), universeEventBySlug(slug)]);
  if (e === "not_configured" && !uv)
    return (
      <ReadingPage locale={locale} crumbs={[{ href: "/events", label: t.title }, { label: t.eventCrumb }]} title={t.event}>
        <div className="zq-pagebody">
          <EmptyState tone="soon" label={<span className="zq-soon">{u.soon}</span>} title={t.notConnected} />
        </div>
      </ReadingPage>
    );
  if ((!e || e === "not_configured") && !uv) {
    // A merged-away event keeps its address: it redirects to the event it was merged into.
    const to = await redirectTarget(slug);
    if (to && to !== slug) redirect(`/events/${to}`);
    notFound();
  }
  if (!e || e === "not_configured") return <UniverseOnlyPage u={uv!} locale={locale} />;
  const [story, player] = await Promise.all([getStory({ event: slug }), getPlayerBundle({ event: slug })]);
  // Items of the Complete Timeline say how they are ordered; a year appears only for a historians' dated estimate.
  const when = uv ? orderingText(uv, timelineStrings(locale)) : (formatRange(e.start_year, e.end_year, e.start_ah, e.end_ah, e.date_precision === "estimated") ?? u.precision[e.date_precision]);
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ href: "/events", label: t.title }, { label: e.title }]}
      kicker={<span className="pp-chap">{when}</span>}
      title={
        <>
          <span {...en}>{e.title}</span>{" "}
          {e.title_ar ? (
            <small lang="ar" dir="rtl" style={{ font: "400 26px/1 var(--font-naskh)", color: "var(--ink-muted)" }}>
              {e.title_ar}
            </small>
          ) : null}
        </>
      }
      lead={e.summary ? <span {...en}>{e.summary}</span> : undefined}
      meta={e.evidence_claims ? <EvidenceLabel kind={e.evidence_claims.evidence} /> : undefined}
    >
      <div className="pp-grid">
        <div>
          {uv ? <UniverseSections u={uv} locale={locale} /> : null}
          {player?.scripts.length ? <StoryPlayerSection bundle={player} locale={locale} /> : null}
          {story.state === "ok" && story.story ? (
            <StoryView story={story.story} name={e.title} chapterKey={`event:${e.slug}`} />
          ) : (
            <EmptyState label={<EvidenceLabel kind="unknown">{t.notWritten}</EvidenceLabel>} title={t.storyPending} />
          )}
          <section className="pp-sec" id="discuss" aria-labelledby="d-h">
            <h2 id="d-h">{t.discussion}</h2>
            <DiscussionPreview contentType="event" contentId={slug} />
          </section>
        </div>
        <aside className="pp-side" aria-label={t.connections}>
          <div className="pp-card">
            <h3>{t.onTimeline}</h3>
            <p className="zq-meta" style={{ margin: 0 }}>
              {when}
            </p>
            <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href={`/timeline?selected=event-${slug}`}>
              {t.seeOnTimeline}
            </Link>
          </div>
          {e.event_people.some((x) => x.people) ? (
            <div className="pp-card">
              <h3>{t.people}</h3>
              <ul style={{ margin: 0, paddingInlineStart: 18 }} {...en}>
                {e.event_people.map((x) =>
                  x.people ? (
                    <li key={x.people.slug}>
                      <Link href={`/prophets/${x.people.slug}`}>{x.people.name_en}</Link>
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          ) : null}
          <div className="pp-card">
            <h3>{t.places}</h3>
            {e.event_places.some((x) => x.locations) ? (
              <ul style={{ margin: 0, paddingInlineStart: 18 }} {...en}>
                {e.event_places.map((x) => (x.locations ? <li key={x.locations.slug}>{x.locations.name_en}</li> : null))}
              </ul>
            ) : (
              <p className="zq-meta" style={{ margin: 0 }}>
                {t.noPlace}
              </p>
            )}
            <Link className="zq-btn zq-btn-quiet zq-btn-sm zq-btn-link" href="/atlas">
              {t.openAtlas}
            </Link>
          </div>
        </aside>
      </div>
    </ReadingPage>
  );
}
