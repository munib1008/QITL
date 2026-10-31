import Link from "next/link";
import "@/styles/timeline.css";
import { EmptyState } from "@/components/ui/misc";
import { EvidenceLabel } from "@/components/ui/evidence";
import { chunk, groupLanes, type UniverseCounts, type UniverseEvent } from "@/lib/events/model";
import { filterByTracks, TRACK_IDS, type TrackId } from "@/lib/events/tracks";
import { fmt, timelineStrings } from "@/lib/i18n/modules/timeline";
import { TrackFilters } from "./TrackFilters";
import { TrackIcon } from "./TrackIcon";
import { UniverseCard } from "./UniverseCard";

/** The Journey (guided) | The Complete Timeline switch. Links, so it works without JavaScript. */
export function ViewSwitch({ locale, view }: { locale: string; view: "journey" | "complete" }) {
  const s = timelineStrings(locale);
  return (
    <nav className="tl-views" aria-label={s.view.label} data-testid="view-switch">
      <Link href="/timeline" aria-current={view === "journey" ? "page" : undefined} data-view="journey">
        {s.view.journey}
      </Link>
      <Link href="/timeline?view=complete" aria-current={view === "complete" ? "page" : undefined} data-view="complete">
        {s.view.complete}
      </Link>
    </nav>
  );
}

/** The designed empty state: nothing is published yet. Counts only; no title of an item under review is shown. */
function Empty({ locale, counts, state }: { locale: string; counts: UniverseCounts | null; state: "empty" | "not_connected" | "error" }) {
  const s = timelineStrings(locale);
  return (
    <EmptyState
      label={<EvidenceLabel kind="unknown">{state === "empty" ? s.empty.title.replace(/\.$/, "") : state === "error" ? s.complete.loadError : s.complete.notConnected}</EvidenceLabel>}
      title={state === "empty" ? s.empty.title : state === "error" ? s.complete.loadError : s.complete.notConnected}
    >
      <p>{s.empty.body}</p>
      {counts && counts.under_review > 0 ? (
        <>
          <p data-testid="under-review-count">
            <b>{counts.under_review === 1 ? s.empty.underReviewOne : fmt(s.empty.underReview, { n: counts.under_review })}</b>
          </p>
          <ul className="tl-counts" aria-label={s.empty.perTrack}>
            {counts.byTrack
              .filter((r) => r.under_review > 0)
              .map((r) => (
                <li key={r.track} data-track={r.track}>
                  <TrackIcon track={r.track} size={16} />
                  <span>{s.tracks[r.track].name}</span>
                  <b>{r.under_review}</b>
                </li>
              ))}
          </ul>
          <p className="zq-meta">{s.empty.counts}</p>
        </>
      ) : null}
    </EmptyState>
  );
}

/**
 * The research atlas: track filters, then lanes (relative order, historians' estimates, disputed order, order not
 * established, parables), each grouped into eras. Long lists are cut into native disclosures ("Show N more"), so the
 * first screen stays light with 200+ items and nothing needs JavaScript; cards use content-visibility to skip
 * off-screen layout.
 */
export function CompleteTimeline({
  locale,
  items,
  counts,
  selected,
  synthetic = false,
}: {
  locale: string;
  items: UniverseEvent[] | null;
  counts: UniverseCounts | null;
  selected: TrackId[];
  synthetic?: boolean;
}) {
  const s = timelineStrings(locale);
  const shown = items ? filterByTracks(items, selected) : [];
  const groups = groupLanes(shown);
  const trackCount = (t: TrackId) => (items ?? []).filter((i) => i.track === t).length;
  return (
    <div className="tl-complete" data-testid="complete-timeline" data-shown={shown.length}>
      {locale !== "en" ? <p className="zq-meta tl-draftnote">{s.draft}</p> : null}
      {synthetic ? (
        <p className="tl-synthetic" role="note" data-testid="synthetic-banner">
          {s.complete.synthetic}
        </p>
      ) : null}
      <p className="lead tl-lead">{s.complete.lead}</p>
      <TrackFilters
        selected={selected}
        tracks={TRACK_IDS.map((id) => ({ id, name: s.tracks[id].name, note: s.tracks[id].note, count: trackCount(id) }))}
        labels={{ legend: s.filters.legend, hint: s.filters.hint, all: s.filters.all, none: s.filters.none, status: s.filters.status, apply: s.filters.apply }}
      />
      {items === null ? (
        <Empty locale={locale} counts={null} state={counts === null ? "not_connected" : "error"} />
      ) : items.length === 0 ? (
        <Empty locale={locale} counts={counts} state="empty" />
      ) : shown.length === 0 ? (
        <p className="zq-meta" role="status" data-testid="none-shown">
          {s.complete.noneShown}
        </p>
      ) : (
        <>
          <p className="zq-meta tl-scale">
            {s.complete.scale} · <span data-testid="shown-count">{shown.length === 1 ? s.complete.countOne : fmt(s.complete.count, { n: shown.length })}</span>
          </p>
          <nav className="tl-jump" aria-label={s.complete.jumpLabel}>
            {groups.map((g) => (
              <a key={g.lane} href={`#lane-${g.lane}`}>
                {s.lanes[g.lane].title} <span className="tl-jump-n">{g.count}</span>
              </a>
            ))}
          </nav>
          {groups.map((g) => (
            <section key={g.lane} id={`lane-${g.lane}`} className="tl-lane" data-lane={g.lane} aria-labelledby={`lane-h-${g.lane}`}>
              <h2 id={`lane-h-${g.lane}`} className="tl-lane-title">
                {s.lanes[g.lane].title} <span className="tl-lane-n">{g.count}</span>
              </h2>
              <p className="zq-meta tl-lane-note">{s.lanes[g.lane].note}</p>
              {g.eras.map((era) => {
                const label = era.key in s.eras ? s.eras[era.key as keyof typeof s.eras] : era.key in s.tracks ? s.tracks[era.key as TrackId].name : null;
                const parts = chunk(era.items);
                return (
                  <div key={era.key} className="tl-era" data-era={era.key}>
                    {label && g.lane !== "parable" ? (
                      <h3 className="tl-era-title">
                        {label} <span className="tl-lane-n">{era.items.length}</span>
                      </h3>
                    ) : null}
                    {parts.map((part, n) =>
                      n === 0 ? (
                        <ul key={n} className="tl-list">
                          {part.map((e) => (
                            <UniverseCard key={e.id} e={e} s={s} />
                          ))}
                        </ul>
                      ) : (
                        <details key={n} className="tl-more">
                          <summary>{fmt(s.card.showMore, { n: part.length })}</summary>
                          <ul className="tl-list">
                            {part.map((e) => (
                              <UniverseCard key={e.id} e={e} s={s} />
                            ))}
                          </ul>
                        </details>
                      ),
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
