import Link from "next/link";
import { CitationChip, EditorialStatus, EvidenceLabel } from "@/components/ui/evidence";
import { fmt, type TimelineStrings } from "@/lib/i18n/modules/timeline";
import { dateLabel, laneOf } from "@/lib/events/ordering";
import { verseText, type UniverseEvent } from "@/lib/events/model";
import { ayahHash } from "@/lib/refs";
import { TrackIcon } from "./TrackIcon";

/** The words for how an item is ordered or dated. A year is shown only for a historians' dated estimate. */
export function OrderingNote({ e, s }: { e: UniverseEvent; s: TimelineStrings }) {
  const lane = laneOf(e);
  const date = dateLabel(e);
  switch (lane) {
    case "relative":
      return (
        <p className="tl-order" data-ordering="relative">
          <b>{s.order.relative}</b>
          {e.relative_position != null ? <span> · {fmt(s.order.position, { n: e.relative_position })}</span> : null}
        </p>
      );
    case "dated":
      return (
        <p className="tl-order" data-ordering="dated_estimate">
          <b>{date ?? s.order.estimate}</b> · <span>{s.order.estimate}</span>
          {e.dating_method ? (
            <span className="tl-method">
              {" "}
              · {s.order.method}: {e.dating_method}
            </span>
          ) : null}
        </p>
      );
    case "disputed":
      return (
        <div className="tl-order" data-ordering="disputed">
          <b>{e.orderViews.length ? fmt(s.order.disputedViews, { n: e.orderViews.length }) : s.order.disputed}</b>
          {e.orderViews.length ? (
            <ul className="tl-views-list">
              {e.orderViews.map((v) => (
                <li key={v.view}>{v.view}</li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    case "parable":
      return (
        <p className="tl-order" data-ordering="parable">
          <b>{s.order.parable}</b>
        </p>
      );
    default:
      return (
        <p className="tl-order" data-ordering="not_established">
          <b>{s.order.notEstablished}</b>
        </p>
      );
  }
}

/** One item of the Complete Timeline. Drafts never reach it: only published rows are loaded. */
export function UniverseCard({ e, s }: { e: UniverseEvent; s: TimelineStrings }) {
  const place = e.connections.find((c) => c.target_kind === "place");
  const person = e.connections.find((c) => c.target_kind === "person");
  return (
    <li className="tl-card" data-track={e.track} data-ordering-kind={e.ordering_kind} data-testid="tl-card" id={`ev-${e.slug}`}>
      <div className="tl-card-head">
        <span className="tl-track" data-track={e.track}>
          <TrackIcon track={e.track} size={16} />
          <span>{s.tracks[e.track].name}</span>
        </span>
        <EditorialStatus status="published">{s.card.status}</EditorialStatus>
      </div>
      <h4 className="tl-card-title">
        <Link href={`/events/${e.slug}`}>{e.title}</Link>
        {e.title_ar ? (
          <span lang="ar" dir="rtl" className="tl-card-ar">
            {" "}
            {e.title_ar}
          </span>
        ) : null}
      </h4>
      {e.name_source === "later_tradition" ? (
        <p className="tl-later" data-testid="later-tradition">
          <span aria-hidden="true">◇</span> {s.name.later}
        </p>
      ) : null}
      <OrderingNote e={e} s={s} />
      {e.evidence ? (
        <p className="tl-ev">
          <EvidenceLabel kind={e.evidence} />
        </p>
      ) : null}
      <div className="tl-verses" role="group" aria-label={s.card.verses}>
        {e.verses.map((v) => (
          <CitationChip key={verseText(v)} href={`/quran/${v.surah}${ayahHash(v.ayah_from, v.ayah_to)}`} ariaLabel={`${s.card.verses} ${verseText(v)}`}>
            {`Q ${verseText(v)}`}
          </CitationChip>
        ))}
      </div>
      <div className="zq-actions tl-actions">
        <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href={`/events/${e.slug}`}>
          {s.card.open}
        </Link>
        {place ? (
          <Link className="zq-btn zq-btn-quiet zq-btn-sm zq-btn-link" href={`/atlas?focus=${encodeURIComponent(place.slug)}`}>
            {s.card.atlas}
          </Link>
        ) : null}
        {person ? (
          <Link className="zq-btn zq-btn-quiet zq-btn-sm zq-btn-link" href={`/genealogy?focus=${encodeURIComponent(person.slug)}`}>
            {s.card.genealogy}
          </Link>
        ) : null}
      </div>
    </li>
  );
}
