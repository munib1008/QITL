import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { StoryView } from "@/components/story/StoryView";
import { DiscussionPreview } from "@/components/community/DiscussionPreview";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { PRECISION_TEXT, type DatePrecision } from "@/components/ui/cards";
import { getPublicSupabase } from "@/lib/supabase/server";
import { getStory } from "@/lib/data/story";
import { formatRange } from "@/lib/years";
import type { EvidenceKind } from "@/content/labels";

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = await load((await params).slug);
  return e && e !== "not_configured" ? { title: e.title, description: e.summary ?? undefined } : { title: "Quranic event" };
}

export default async function EventPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const e = await load(slug);
  if (e === "not_configured")
    return (
      <ReadingPage locale={locale} crumbs={[{ href: "/events", label: "Quranic events" }, { label: "Event" }]} title="Quranic event">
        <div className="zq-pagebody">
          <EmptyState tone="soon" label={<span className="zq-soon">Coming soon</span>} title="The events encyclopedia is not connected yet." />
        </div>
      </ReadingPage>
    );
  if (!e) notFound();
  const story = await getStory({ event: slug });
  const when = formatRange(e.start_year, e.end_year, e.start_ah, e.end_ah, e.date_precision === "estimated") ?? PRECISION_TEXT[e.date_precision];
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ href: "/events", label: "Quranic events" }, { label: e.title }]}
      kicker={<span className="pp-chap">{when}</span>}
      title={
        <>
          {e.title}{" "}
          {e.title_ar ? (
            <small lang="ar" dir="rtl" style={{ font: "400 26px/1 var(--font-naskh)", color: "var(--ink-muted)" }}>
              {e.title_ar}
            </small>
          ) : null}
        </>
      }
      lead={e.summary ?? undefined}
      meta={e.evidence_claims ? <EvidenceLabel kind={e.evidence_claims.evidence} /> : undefined}
    >
      <div className="pp-grid">
        <div>
          {story.state === "ok" && story.story ? (
            <StoryView story={story.story} name={e.title} />
          ) : (
            <EmptyState label={<EvidenceLabel kind="unknown">Not yet written</EvidenceLabel>} title="The full story of this event is not published yet." />
          )}
          <section className="pp-sec" id="discuss" aria-labelledby="d-h">
            <h2 id="d-h">Discussion</h2>
            <DiscussionPreview contentType="event" contentId={slug} />
          </section>
        </div>
        <aside className="pp-side" aria-label="Connections">
          <div className="pp-card">
            <h3>On the timeline</h3>
            <p className="zq-meta" style={{ margin: 0 }}>
              {when}
            </p>
            <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href={`/timeline?selected=event-${slug}`}>
              See on the timeline
            </Link>
          </div>
          {e.event_people.some((x) => x.people) ? (
            <div className="pp-card">
              <h3>People</h3>
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
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
            <h3>Places</h3>
            {e.event_places.some((x) => x.locations) ? (
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                {e.event_places.map((x) => (x.locations ? <li key={x.locations.slug}>{x.locations.name_en}</li> : null))}
              </ul>
            ) : (
              <p className="zq-meta" style={{ margin: 0 }}>
                No location is established for this event.
              </p>
            )}
            <Link className="zq-btn zq-btn-quiet zq-btn-sm zq-btn-link" href="/atlas">
              Open the atlas
            </Link>
          </div>
        </aside>
      </div>
    </ReadingPage>
  );
}
