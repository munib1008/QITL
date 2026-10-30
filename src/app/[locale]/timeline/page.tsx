import type { Metadata } from "next";
import Link from "next/link";
import { ERA_TEXT, PLACE_TEXT, findStop, getJourney } from "@/content/journey";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { VerticalTimeline } from "@/components/ui/VerticalTimeline";
import { CitationChip, DraftBadge, EraTag, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { journeyTimeline, todayLabel } from "@/lib/timeline";
import { quranHref } from "@/lib/refs";

export const metadata: Metadata = {
  title: "Timeline",
  description: "From Adam to today, in order and not to scale. Undated sacred history stays on a relative-order track.",
};

export default async function TimelinePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ selected?: string }> }) {
  const { locale } = await params;
  const { selected } = await searchParams;
  const j = getJourney();
  const pos = selected ? findStop(selected) : undefined;
  const s = pos?.item;
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: "Timeline" }]}
      kicker={<DraftBadge status={j.status} />}
      title="Timeline"
      lead="Ordered from Adam to today, not to scale. Sacred history before recorded chronology has no years; dated history shows CE and AH with how certain each date is."
    >
      <div className="zq-pagebody">
        <div className="zq-split">
          <div>
            <VerticalTimeline eras={journeyTimeline(j)} selected={s?.id} today={todayLabel()} />
            <p className="zq-meta" style={{ padding: "0 16px" }}>
              Signs of the Last Hour are not placed on this timeline: no date is known. See the <Link href="/last-hour">Last Hour explorer</Link>.
            </p>
          </div>
          <div className="zq-split-sticky" aria-live="polite">
            {s ? (
              <article className="zq-card" style={{ maxWidth: "none" }} aria-labelledby="sel-title">
                <div className="zq-card-head">
                  <p className="zq-eyebrow">{s.type === "milestone" ? "Milestone" : "Prophet"}</p>
                  <EraTag {...s.era} />
                </div>
                <h2 id="sel-title" className="zq-title" style={{ fontSize: 24, lineHeight: "32px", fontFamily: "var(--font-display)" }}>
                  {s.name} <span lang="ar" className="zq-meta" style={{ display: "inline" }}>{s.honorific}</span>
                </h2>
                <p className="zq-meta">{s.summary}</p>
                <dl className="zq-kv">
                  <dt>Date</dt>
                  <dd>
                    {s.era.label} — {ERA_TEXT[s.era.certainty]}
                  </dd>
                  <dt>Place</dt>
                  <dd>
                    {PLACE_TEXT[s.place?.certainty ?? "unknown"]}: {s.place?.name ?? "Unknown"}
                  </dd>
                </dl>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {(s.evidence ?? ["quran"]).map((k) => (
                    <EvidenceLabel key={k} kind={k} />
                  ))}
                  {(s.surahs ?? []).slice(0, 3).flatMap((su) => su.passages.slice(0, 1).map((p) => <CitationChip key={p} href={quranHref(p)}>{`Q ${p}`}</CitationChip>))}
                </div>
                <div className="zq-actions">
                  <Link className="zq-btn zq-btn-primary zq-btn-sm zq-btn-link" href={`/prophets/${s.id}`}>
                    Read the story
                  </Link>
                  <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href={`/atlas?focus=${s.id}`}>
                    Show on the atlas
                  </Link>
                  {pos?.next ? (
                    <Link className="zq-btn zq-btn-quiet zq-btn-sm zq-btn-link" href={`/timeline?selected=${pos.next.id}`} scroll={false}>
                      Next: {pos.next.name} →
                    </Link>
                  ) : null}
                </div>
              </article>
            ) : (
              <EmptyState label={<EvidenceLabel kind="unknown">Nothing selected</EvidenceLabel>} title="Select a stop on the timeline.">
                <p>Its card, evidence and place appear here. Each stop links to its story and to the atlas.</p>
              </EmptyState>
            )}
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
      <h3>Date certainty</h3>
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
