import type { Metadata } from "next";
import Link from "next/link";
import { findStop, getJourney } from "@/content/journey";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { VerticalTimeline } from "@/components/ui/VerticalTimeline";
import { DraftBadge } from "@/components/ui/evidence";
import { journeyTimeline, todayLabel } from "@/lib/timeline";
import { eventEras, publishedEvents } from "@/lib/data/events";
import { TimelineLayers } from "@/components/lifestyle/TimelineLayers";
import { CompleteTimeline, ViewSwitch } from "@/components/timeline/CompleteTimeline";
import { e2eFixturesEnabled } from "@/lib/e2e-fixtures";
import { parseTracks } from "@/lib/events/tracks";
import { publishedUniverse, universeCounts } from "@/lib/events/universe";

export const metadata: Metadata = {
  title: "Timeline",
  description: "From Adam to today, in order and not to scale. Undated sacred history stays on a relative-order track.",
};

/** Reviewed events are read from the database; refresh every 5 minutes. */
export const revalidate = 300;

export default async function TimelinePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ selected?: string; layer?: string; view?: string; tracks?: string | string[] }> }) {
  const { locale } = await params;
  const { selected, layer, view, tracks } = await searchParams;
  // The Complete Timeline (research atlas) is a second view of the same page; the guided Journey stays the default.
  if (view === "complete") {
    const [items, counts] = await Promise.all([publishedUniverse(), universeCounts()]);
    return (
      <ReadingPage
        locale={locale}
        crumbs={[{ label: "Timeline" }]}
        title="Timeline"
        lead="From Adam to today, in order and not to scale. Undated sacred history stays on a relative-order track."
      >
        <div className="zq-pagebody">
          <ViewSwitch locale={locale} view="complete" />
          <CompleteTimeline locale={locale} items={items} counts={counts} selected={parseTracks(tracks)} synthetic={e2eFixturesEnabled()} />
        </div>
      </ReadingPage>
    );
  }
  const j = getJourney();
  const pos = selected ? findStop(selected) : undefined;
  const s = pos?.item;
  // Reviewed events from the database sit on their own track below the journey.
  const events = await publishedEvents({ universe: false });
  const ev = selected?.startsWith("event-") ? events?.find((e) => `event-${e.slug}` === selected) : undefined;
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: "Timeline" }]}
      kicker={<DraftBadge status={j.status} />}
      title="Timeline"
      lead="Ordered from Adam to today, not to scale. Sacred history before recorded chronology has no years; dated history shows CE and AH with how certain each date is."
    >
      <div className="zq-pagebody">
        <ViewSwitch locale={locale} view="journey" />
        <div className="zq-split">
          <TimelineLayers locale={locale} layer={layer}>
          <div>
            <VerticalTimeline eras={journeyTimeline(j)} selected={s?.id} today={todayLabel()} enhance />
            {events?.length ? (
              <section aria-labelledby="reviewed-events-h" style={{ marginTop: 24 }}>
                <h2 id="reviewed-events-h" className="zq-eyebrow" style={{ padding: "0 16px" }}>
                  Reviewed events
                </h2>
                <VerticalTimeline eras={eventEras(events)} selected={ev ? selected : undefined} today={false} label="Reviewed events" />
              </section>
            ) : null}
            <p className="zq-meta" style={{ padding: "0 16px" }}>
              Signs of the Last Hour are not placed on this timeline: no date is known. See the <Link href="/last-hour">Last Hour explorer</Link>.
            </p>
          </div>
          </TimelineLayers>
          <div className="zq-split-sticky">
            <p className="zq-meta zq-vt-hint">Tap a stop to open its card: summary, date certainty, place, sources and the full story.</p>
            <div style={{ marginTop: 16 }}>
              <DateLegend />
            </div>
          </div>
        </div>
      </div>
    </ReadingPage>
  );
}

/** What each timeline mark means, drawn with the same marks the timeline uses. */
function DateLegend() {
  const rows: Array<[string, string]> = [
    ["zq-vt-dia", "Relative order — no date is known"],
    ["zq-vt-dot", "Established date"],
    ["zq-vt-bar", "Date range"],
    ["zq-vt-bar zq-vt-est", "Historians' estimate"],
    ["zq-vt-unk", "Date unknown"],
  ];
  return (
    <section className="zq-legend" aria-label="Timeline legend" style={{ boxShadow: "none" }}>
      <h2>Date certainty</h2>
      <ul>
        {rows.map(([cls, label]) => (
          <li key={label}>
            <span style={{ position: "relative", width: 28, height: 20, display: "inline-block" }} aria-hidden="true">
              <span className={`zq-vt-mark ${cls}`} style={{ position: "absolute", insetInlineStart: 8, top: cls.includes("bar") ? -4 : 4 }} />
            </span>
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
