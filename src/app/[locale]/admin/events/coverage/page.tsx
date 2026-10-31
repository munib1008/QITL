import Link from "next/link";
import "@/styles/timeline.css";
import narrative from "@content/events/narrative-ranges.json";
import surahs from "@content/quran/surahs.json";
import { EmptyState } from "@/components/ui/misc";
import { computeCoverage } from "@/lib/events/coverage";
import { TRACK_IDS } from "@/lib/events/tracks";
import { formatRef, parseRef, type Ref } from "@/lib/events/verify";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Research coverage of the Event Universe, from the database (every status; the editorial layout limits this to
 * staff). The same figures are written to docs/EVENT_COVERAGE.md by scripts/event-coverage-report.ts.
 */
export const metadata = { title: "Event coverage" };

const NAME = new Map((surahs as Array<{ number: number; name: string }>).map((s) => [s.number, s.name]));
const link = (r: Ref) => (
  <Link key={formatRef(r)} href={`/quran/${r.surah}#ayah-${r.from}${r.to > r.from ? `-${r.to}` : ""}`} className="zq-chip" style={{ marginInlineEnd: 6 }}>
    <span dir="ltr">{formatRef(r)}</span>
  </Link>
);

export default async function EventCoveragePage() {
  const sb = await getServerSupabase();
  if (!sb) return <EmptyState title="The coverage report needs the database." />;
  const [events, refs] = await Promise.all([
    sb.from("historical_events").select("id, track, status, name_source, ordering_kind").not("track", "is", null).limit(5000),
    sb.from("event_verse_refs").select("event_id, surah, ayah_from, ayah_to, claim_id").limit(20000),
  ]);
  if (events.error || refs.error) return <EmptyState title="The coverage report could not be loaded." />;
  const ev = (events.data ?? []) as Array<{ id: string; track: string; status: string; name_source: string; ordering_kind: string }>;
  const rr = (refs.data ?? []) as Array<{ event_id: string; surah: number; ayah_from: number; ayah_to: number; claim_id: string | null }>;
  const covered: Ref[] = rr.map((r) => ({ surah: r.surah, from: r.ayah_from, to: r.ayah_to }));
  const research = narrative.toResearch.map((r) => ({ ...r, range: parseRef(r.ref)! }));
  const cov = computeCoverage(covered, research.map((r) => r.range));
  const statuses = ["draft", "in_review", "approved", "published", "correction", "archived"];
  const withRefs = new Set(rr.map((r) => r.event_id));
  const noVerses = ev.filter((e) => !withRefs.has(e.id) && e.status !== "archived").length;
  const unclaimed = rr.filter((r) => !r.claim_id).length;
  const later = ev.filter((e) => e.name_source === "later_tradition").length;
  const unassigned = ev.filter((e) => e.ordering_kind === "unassigned" && e.track !== "parables").length;

  return (
    <div style={{ display: "grid", gap: 24 }} data-testid="event-coverage">
      <div>
        <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Event Universe: research coverage</h1>
        <p className="zq-meta">
          Which narrative passages of the imported Quran text an inventory item covers, which it does not, and the counts per track. &ldquo;Narrative&rdquo; is an editorial judgement, so the percentage is the share of the register
          (the inventory plus the ranges still to research), not a proof of completeness. Method and the full list: <code>docs/EVENT_COVERAGE.md</code>.
        </p>
      </div>

      <section className="pp-card" aria-labelledby="cov-sum">
        <h2 id="cov-sum" style={{ font: "500 20px/28px var(--font-display)", margin: 0 }}>Summary</h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          <li>
            Inventory items: <b data-testid="cov-items">{ev.length}</b> · verse references: <b>{rr.length}</b>
          </li>
          <li>
            Narrative register: <b>{cov.narrative}</b> ayat · covered: <b data-testid="cov-covered">{cov.covered}</b> (<b data-testid="cov-percent">{cov.percent}%</b>) · not yet covered: <b>{cov.uncovered}</b>
          </li>
          <li>
            Items with no verse reference: <b>{noVerses}</b> · verse references without an approved claim yet: <b>{unclaimed}</b>
          </li>
          <li>
            Names from later tradition (flagged): <b>{later}</b> · items in the &ldquo;Order not established&rdquo; lane: <b>{unassigned}</b>
          </li>
        </ul>
      </section>

      <section aria-labelledby="cov-tracks">
        <h2 id="cov-tracks" style={{ font: "500 20px/28px var(--font-display)", margin: "0 0 8px" }}>Items per track and status</h2>
        <div className="zq-table-scroll" role="region" aria-label="Items per track and status" tabIndex={0}>
          <table className="tl-admin-table" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th scope="col">Track</th>
                {statuses.map((s) => (
                  <th key={s} scope="col">
                    {s.replace("_", " ")}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {TRACK_IDS.map((t) => (
                <tr key={t}>
                  <th scope="row">{t}</th>
                  {statuses.map((s) => (
                    <td key={s}>{ev.filter((e) => e.track === t && e.status === s).length}</td>
                  ))}
                  <td>
                    <b>{ev.filter((e) => e.track === t).length}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="cov-todo">
        <h2 id="cov-todo" style={{ font: "500 20px/28px var(--font-display)", margin: "0 0 8px" }}>Items to research ({research.length})</h2>
        <p className="zq-meta">Narrative passages with no item yet, usually because the event or people are given only by later sources.</p>
        <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
          {research.map((r) => (
            <li key={r.ref} className="pp-card">
              {link(r.range)} <b>{r.label}</b>
              <span className="zq-meta" style={{ display: "block" }}>
                {NAME.get(r.range.surah)} · {r.why}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cov-un">
        <h2 id="cov-un" style={{ font: "500 20px/28px var(--font-display)", margin: "0 0 8px" }}>Ranges not yet covered</h2>
        <p>{cov.uncoveredRanges.length ? cov.uncoveredRanges.map(link) : "None."}</p>
      </section>

      <section aria-labelledby="cov-surah">
        <h2 id="cov-surah" style={{ font: "500 20px/28px var(--font-display)", margin: "0 0 8px" }}>Narrative ayat by surah</h2>
        <div className="zq-table-scroll" role="region" aria-label="Narrative ayat by surah" tabIndex={0}>
          <table className="tl-admin-table" style={{ minWidth: 420 }}>
            <thead>
              <tr>
                <th scope="col">Surah</th>
                <th scope="col">Narrative ayat</th>
                <th scope="col">Covered</th>
                <th scope="col">Not covered</th>
              </tr>
            </thead>
            <tbody>
              {cov.bySurah.map((s) => (
                <tr key={s.surah}>
                  <th scope="row">
                    <Link href={`/quran/${s.surah}`}>
                      {s.surah} {NAME.get(s.surah)}
                    </Link>
                  </th>
                  <td>{s.narrative}</td>
                  <td>{s.covered}</td>
                  <td>{s.narrative - s.covered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="cov-excl">
        <h2 id="cov-excl" style={{ font: "500 20px/28px var(--font-display)", margin: "0 0 8px" }}>Reviewed and not counted</h2>
        <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
          {narrative.reviewedNotCounted.map((r) => (
            <li key={r.ref} className="pp-card">
              {link(parseRef(r.ref)!)} <b>{r.label}</b>
              <span className="zq-meta" style={{ display: "block" }}>
                {r.reason}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
