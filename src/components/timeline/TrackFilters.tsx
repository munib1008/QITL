"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { completeHref, toggleTrack, TRACK_IDS, type TrackId } from "@/lib/events/tracks";
import { TrackBadge } from "./TrackIcon";

export interface TrackFilterLabels {
  legend: string;
  hint: string;
  all: string;
  none: string;
  status: string;
  apply: string;
}

/**
 * Multi-select track chips. A real form: checkboxes in a fieldset (keyboard: Tab, Space), 44px targets, a polite status
 * line, and the selection in the URL (?tracks=…). With JavaScript a change applies at once (router.replace, no scroll
 * jump); without it the Apply button submits the same form. Every track is on by default and stays out of the URL.
 */
export function TrackFilters({
  selected,
  tracks,
  labels,
}: {
  selected: TrackId[];
  tracks: Array<{ id: TrackId; name: string; note: string; count: number }>;
  labels: TrackFilterLabels;
}) {
  const router = useRouter();
  const [on, setOn] = useState<TrackId[]>(selected);
  const [pending, start] = useTransition();
  const key = selected.join(",");
  useEffect(() => setOn(selected), [key]); // eslint-disable-line react-hooks/exhaustive-deps -- follows the URL (back/forward)
  const go = (next: TrackId[]) => {
    setOn(next);
    start(() => router.replace(completeHref(next), { scroll: false }));
  };
  const status = labels.status.replace("{shown}", String(on.length)).replace("{total}", String(TRACK_IDS.length));
  return (
    <form method="get" action="/timeline" className="tl-filters" data-testid="track-filters" data-pending={pending || undefined}>
      <input type="hidden" name="view" value="complete" />
      {/* Always present so that clearing every checkbox is an explicit "none", not the default. */}
      <input type="hidden" name="tracks" value="-" />
      <fieldset>
        <legend>{labels.legend}</legend>
        <p className="zq-meta tl-filters-hint">{labels.hint}</p>
        <div className="tl-chips">
          {tracks.map((t) => {
            const isOn = on.includes(t.id);
            return (
              <label key={t.id} className="tl-chip" data-track={t.id} data-on={isOn} title={t.note}>
                <input type="checkbox" name="tracks" value={t.id} checked={isOn} onChange={() => go(toggleTrack(on, t.id))} />
                <span className="tl-chip-check" aria-hidden="true">
                  {isOn ? "✓" : ""}
                </span>
                <TrackBadge track={t.id} />
                <span className="tl-chip-name">{t.name}</span>
                <span className="tl-chip-n">{t.count}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="tl-filter-actions">
        <Link className="zq-btn zq-btn-quiet zq-btn-sm" href={completeHref([...TRACK_IDS])} onClick={(e) => { e.preventDefault(); go([...TRACK_IDS]); }}>
          {labels.all}
        </Link>
        <Link className="zq-btn zq-btn-quiet zq-btn-sm" href={completeHref([])} onClick={(e) => { e.preventDefault(); go([]); }}>
          {labels.none}
        </Link>
        <button type="submit" className="zq-btn zq-btn-secondary zq-btn-sm tl-apply">
          {labels.apply}
        </button>
      </div>
      <p className="zq-meta" role="status" aria-live="polite" data-testid="track-status">
        {status}
      </p>
    </form>
  );
}
