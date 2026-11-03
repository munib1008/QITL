import type { Metadata } from "next";
import Link from "next/link";
import { findStop, getJourney } from "@/content/journey";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { VerticalTimeline } from "@/components/ui/VerticalTimeline";
import { DraftBadge } from "@/components/ui/evidence";
import { journeyTimeline, todayLabel } from "@/lib/timeline";
import { eventEras, publishedEvents } from "@/lib/data/events";
import { TimelineLayers } from "@/components/lifestyle/TimelineLayers";
import { timelineStrings } from "@/lib/i18n/modules/events";
import { CompleteTimeline, ViewSwitch } from "@/components/timeline/CompleteTimeline";
import { e2eFixturesEnabled } from "@/lib/e2e-fixtures";
import { parseTracks, TRACK_IDS } from "@/lib/events/tracks";
import { publishedUniverse, universeCounts } from "@/lib/events/universe";
import { draftLastHour, draftTimeline } from "@/content/draftAtlas";
import { EraScrollTimeline } from "@/components/redesign/EraScrollTimeline";
import { redesignStrings } from "@/lib/i18n/modules/redesign";
import { timelineStrings as completeStrings } from "@/lib/i18n/modules/timeline";
import { englishContent } from "@/lib/i18n/locales";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = timelineStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

/** Reviewed events are read from the database; refresh every 5 minutes. */
export const revalidate = 300;

export default async function TimelinePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ selected?: string; layer?: string; view?: string; tracks?: string | string[] }> }) {
  const { locale } = await params;
  const { selected, layer, view, tracks } = await searchParams;
  const t = timelineStrings(locale);
  // The Complete Timeline (research atlas) is a second view of the same page; the guided Journey stays the default.
  if (view === "complete") {
    const [items, counts] = await Promise.all([publishedUniverse(), universeCounts()]);
    // Nothing reviewed is published yet: show the labelled draft inventory as a scroll story instead of an empty page.
    if (!items || items.length === 0) {
      const draft = draftTimeline();
      const r = redesignStrings(locale);
      return (
        <ReadingPage locale={locale} crumbs={[{ label: t.title }]} title={t.title} lead={t.lead}>
          <div className="zq-pagebody">
            <ViewSwitch locale={locale} view="complete" />
            <EraScrollTimeline
              eras={draft.eras}
              items={draft.items}
              signs={draftLastHour().signs}
              tracks={TRACK_IDS.map((id) => ({ id, name: completeStrings(locale).tracks[id].name, note: completeStrings(locale).tracks[id].note }))}
              s={r.scroll}
              initial={parseTracks(tracks)}
              englishAttrs={englishContent(locale)}
            />
          </div>
        </ReadingPage>
      );
    }
    return (
      <ReadingPage locale={locale} crumbs={[{ label: t.title }]} title={t.title} lead={t.lead}>
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
      crumbs={[{ label: t.title }]}
      kicker={<DraftBadge status={j.status} />}
      title={t.title}
      lead={t.lead}
    >
      <div className="zq-pagebody">
        <ViewSwitch locale={locale} view="journey" />
        <div className="zq-split">
          <TimelineLayers locale={locale} layer={layer}>
          <div>
            <VerticalTimeline eras={journeyTimeline(j, locale)} selected={s?.id} today={todayLabel(new Date(), locale)} enhance locale={locale} />
            {events?.length ? (
              <section aria-labelledby="reviewed-events-h" style={{ marginTop: 24 }}>
                <h2 id="reviewed-events-h" className="zq-eyebrow" style={{ padding: "0 16px" }}>
                  {t.reviewedEvents}
                </h2>
                <VerticalTimeline eras={eventEras(events, locale)} selected={ev ? selected : undefined} today={false} label={t.reviewedEvents} locale={locale} />
              </section>
            ) : null}
            <p className="zq-meta" style={{ padding: "0 16px" }}>
              {t.lastHourNote} <Link href="/last-hour">{t.lastHourLink}</Link>.
            </p>
          </div>
          </TimelineLayers>
          <div className="zq-split-sticky">
            <p className="zq-meta zq-vt-hint">{t.hint}</p>
            <div style={{ marginTop: 16 }}>
              <DateLegend t={t} />
            </div>
          </div>
        </div>
      </div>
    </ReadingPage>
  );
}

/** What each timeline mark means, drawn with the same marks the timeline uses. */
function DateLegend({ t }: { t: ReturnType<typeof timelineStrings> }) {
  const rows: Array<[string, string]> = [
    ["zq-vt-dia", t.legend.relative],
    ["zq-vt-dot", t.legend.exact],
    ["zq-vt-bar", t.legend.range],
    ["zq-vt-bar zq-vt-est", t.legend.estimate],
    ["zq-vt-unk", t.legend.unknown],
  ];
  return (
    <section className="zq-legend" aria-label={t.legendLabel} style={{ boxShadow: "none" }}>
      <h2>{t.legendTitle}</h2>
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
