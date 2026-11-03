import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import type { LastHourSign } from "@/content/draftAtlas";

export interface DraftLastHourStrings {
  draftBanner: string;
  majorTitle: string;
  majorNote: string;
  otherTitle: string;
  majorBadge: string;
}
const ayahHref = (ref: string) => {
  const m = /^(\d{1,3}):(\d{1,3})/.exec(ref);
  return m ? `/quran/${m[1]}#ayah-${m[2]}` : undefined;
};

/** The draft signs of the Last Hour: no date, no countdown, order not stated; every sign shows its evidence and citation. */
export function DraftLastHour({ signs, s, englishAttrs }: { signs: LastHourSign[]; s: DraftLastHourStrings; englishAttrs: { lang?: string; dir?: string } }) {
  const groups: Array<[string, string | null, LastHourSign[]]> = [
    [s.majorTitle, s.majorNote, signs.filter((x) => x.major)],
    [s.otherTitle, null, signs.filter((x) => !x.major)],
  ];
  return (
    <div className="rd-lasthour" data-testid="draft-last-hour">
      <p className="tl-synthetic" role="note" data-testid="draft-banner">
        {s.draftBanner}
      </p>
      {groups.map(([title, note, list]) => (
        <section key={title} aria-labelledby={`lh-${title}`}>
          <h2 id={`lh-${title}`} className="zq-eyebrow">
            {title}
          </h2>
          {note ? <p className="zq-meta">{note}</p> : null}
          <ul className="rd-signs">
            {list.map((x, i) => (
              <li key={x.id} className="rd-sign" id={x.id} data-major={x.major}>
                <span className="rd-sign-n" aria-hidden="true">
                  {x.major ? i + 1 : ""}
                </span>
                <div>
                  <h3 className="rd-sign-title" {...englishAttrs}>
                    {x.title} {x.major ? <span className="rd-badge">{s.majorBadge}</span> : null}
                  </h3>
                  <p className="zq-meta" {...englishAttrs}>
                    {x.note}
                    {x.source ? ` ${x.source}.` : ""}
                  </p>
                  <div className="rd-chips">
                    {x.evidence.map((k) => (
                      <EvidenceLabel key={k} kind={k} />
                    ))}
                    {x.refs.map((r) => (
                      <CitationChip key={r} href={ayahHref(r)}>{`Q ${r}`}</CitationChip>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
