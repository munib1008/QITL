import Link from "next/link";
import "@/styles/timeline.css";
import { CitationChip } from "@/components/ui/evidence";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { OrderingNote } from "./UniverseCard";
import { TrackIcon } from "./TrackIcon";
import { verseText } from "@/lib/events/model";
import type { UniverseDetail } from "@/lib/events/universe";
import { dateLabel, laneOf } from "@/lib/events/ordering";
import { timelineStrings, type TimelineStrings } from "@/lib/i18n/modules/timeline";
import { ayahHash } from "@/lib/refs";

/** The short "order and date" words for the page header: a year only for a historians' dated estimate. */
export function orderingText(u: UniverseDetail, s: TimelineStrings): string {
  switch (laneOf(u)) {
    case "relative":
      return s.order.relative;
    case "dated":
      return `${dateLabel(u) ?? ""} · ${s.order.estimate}`.trim();
    case "disputed":
      return s.order.disputed;
    case "parable":
      return s.order.parable;
    default:
      return s.order.notEstablished;
  }
}

const connectionHref = (c: UniverseDetail["connections"][number]) =>
  c.target_kind === "person" ? `/genealogy?focus=${encodeURIComponent(c.slug)}` : c.target_kind === "place" ? `/atlas?focus=${encodeURIComponent(c.slug)}` : `/events/${c.slug}`;

/** What an event page of the Complete Timeline adds: track, order and date, verses, identification claims, connections, stories. */
export function UniverseSections({ u, locale }: { u: UniverseDetail; locale: string }) {
  const s = timelineStrings(locale);
  const groups = new Map<string, { kind: string; subject: string; views: Array<{ view: string; standing: string }> }>();
  for (const i of u.identifications) {
    const key = `${i.kind}|${i.subject}`;
    const g = groups.get(key) ?? { kind: i.kind, subject: i.subject, views: [] };
    g.views.push({ view: i.view, standing: i.standing });
    groups.set(key, g);
  }
  const kindLabel = (k: string) => (s.event.kinds as Record<string, string>)[k] ?? k;
  const standingLabel = (k: string) => (s.event.standing as Record<string, string>)[k] ?? k;
  return (
    <div data-testid="universe-sections">
      <section className="tl-event-sec" aria-labelledby="u-track-h">
        <h2 id="u-track-h">{s.event.order}</h2>
        <p className="tl-track" data-track={u.track}>
          <TrackIcon track={u.track} size={16} />
          <span>
            {s.event.track}: {s.tracks[u.track].name}
          </span>
        </p>
        <OrderingNote e={u} s={s} />
        {u.name_source === "later_tradition" ? (
          <p className="tl-later" data-testid="later-tradition">
            <span aria-hidden="true">◇</span> {s.name.later}
          </p>
        ) : null}
      </section>
      <section className="tl-event-sec" aria-labelledby="u-verses-h">
        <h2 id="u-verses-h">{s.event.verses}</h2>
        <p className="zq-meta">{s.event.versesNote}</p>
        <div className="tl-verses" role="group" aria-label={s.event.verses}>
          {u.verses.map((v) => (
            <CitationChip key={verseText(v)} href={`/quran/${v.surah}${ayahHash(v.ayah_from, v.ayah_to)}`}>
              {`Q ${verseText(v)}`}
            </CitationChip>
          ))}
        </div>
      </section>
      {groups.size ? (
        <section className="tl-event-sec" aria-labelledby="u-ident-h" data-testid="identifications">
          <h2 id="u-ident-h">{s.event.identifications}</h2>
          <p className="zq-meta">{s.event.identificationsNote}</p>
          {[...groups.values()].map((g) => (
            <div key={`${g.kind}|${g.subject}`} className="tl-ident">
              <b>
                {kindLabel(g.kind)}
                {g.subject ? `: ${g.subject}` : ""}
              </b>
              <ul>
                {g.views.map((v) => (
                  <li key={v.view}>
                    <span className="tl-standing">{standingLabel(v.standing)}</span> {v.view}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
      <section className="tl-event-sec" aria-labelledby="u-conn-h">
        <h2 id="u-conn-h">{s.event.connections}</h2>
        {u.connections.length ? (
          <ul>
            {u.connections.map((c) => (
              <li key={`${c.kind}-${c.target_kind}-${c.slug}`}>
                {(s.event.connectionKinds as Record<string, string>)[c.kind] ?? c.kind}: <Link href={connectionHref(c)}>{c.label}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="zq-meta">{s.event.noConnections}</p>
        )}
      </section>
      {u.stories.length ? (
        <section className="tl-event-sec" aria-labelledby="u-stories-h">
          <h2 id="u-stories-h">{s.event.stories}</h2>
          <ul>
            {u.stories.map((st) => (
              <li key={st.slug}>
                <Link href={`/stories/${st.slug}`}>{st.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Used only when the database is absent and the automated tests supply synthetic items. */
export function UniverseOnlyPage({ u, locale }: { u: UniverseDetail; locale: string }) {
  const s = timelineStrings(locale);
  return (
    <ReadingPage locale={locale} crumbs={[{ href: "/events", label: "Quranic events" }, { label: u.title }]} kicker={<span className="pp-chap">{orderingText(u, s)}</span>} title={u.title}>
      <div className="zq-pagebody">
        <p className="tl-synthetic" role="note">
          {s.complete.synthetic}
        </p>
        <UniverseSections u={u} locale={locale} />
      </div>
    </ReadingPage>
  );
}
