import Link from "next/link";
import "@/styles/timeline.css";
import narrative from "@content/events/narrative-ranges.json";
import surahs from "@content/quran/surahs.json";
import { EmptyState } from "@/components/ui/misc";
import { computeCoverage } from "@/lib/events/coverage";
import { TRACK_IDS } from "@/lib/events/tracks";
import { formatRef, parseRef, type Ref } from "@/lib/events/verify";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { englishContent } from "@/lib/i18n/locales";
import { adminStrings } from "@/lib/i18n/modules/admin";
import { adminCoverageStrings } from "@/lib/i18n/modules/adminCoverage";

/**
 * Research coverage of the Event Universe, from the database (every status; the editorial layout limits this to
 * staff). The same figures are written to docs/EVENT_COVERAGE.md by scripts/event-coverage-report.ts.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: adminStrings((await params).locale).nav["/admin/events/coverage"] };
}

const NAME = new Map((surahs as Array<{ number: number; name: string }>).map((s) => [s.number, s.name]));
const link = (r: Ref) => (
  <Link key={formatRef(r)} href={`/quran/${r.surah}#ayah-${r.from}${r.to > r.from ? `-${r.to}` : ""}`} className="zq-chip" style={{ marginInlineEnd: 6 }}>
    <span dir="ltr">{formatRef(r)}</span>
  </Link>
);

export default async function EventCoveragePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = adminCoverageStrings(locale);
  const sb = await getServerSupabase();
  if (!sb) return <EmptyState title={t.evNeedsDb} />;
  const [events, refs] = await Promise.all([
    sb.from("historical_events").select("id, track, status, name_source, ordering_kind").not("track", "is", null).limit(5000),
    sb.from("event_verse_refs").select("event_id, surah, ayah_from, ayah_to, claim_id").limit(20000),
  ]);
  if (events.error || refs.error) return <EmptyState title={t.evLoadFail} />;
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
        <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{t.evTitle}</h1>
        <p className="zq-meta">
          {t.evLeadA} <code>docs/EVENT_COVERAGE.md</code>.
        </p>
      </div>

      <section className="pp-card" aria-labelledby="cov-sum">
        <h2 id="cov-sum" style={{ font: "500 20px/28px var(--font-display)", margin: 0 }}>{t.summary}</h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          <li>
            {t.evItems} <b data-testid="cov-items">{ev.length}</b> · {t.evVerseRefs} <b>{rr.length}</b>
          </li>
          <li>
            {t.evRegister} <b>{cov.narrative}</b> {t.ayat} · {t.covered} <b data-testid="cov-covered">{cov.covered}</b> (<b data-testid="cov-percent">{cov.percent}%</b>) · {t.notYetCovered} <b>{cov.uncovered}</b>
          </li>
          <li>
            {t.evNoVerses} <b>{noVerses}</b> · {t.evNoClaim} <b>{unclaimed}</b>
          </li>
          <li>
            {t.evLater} <b>{later}</b> · {t.evUnassigned} <b>{unassigned}</b>
          </li>
        </ul>
      </section>

      <section aria-labelledby="cov-tracks">
        <h2 id="cov-tracks" style={{ font: "500 20px/28px var(--font-display)", margin: "0 0 8px" }}>{t.evPerTrack}</h2>
        <div className="zq-table-scroll" role="region" aria-label={t.evPerTrack} tabIndex={0}>
          <table className="tl-admin-table" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th scope="col">{t.track}</th>
                {statuses.map((s) => (
                  <th key={s} scope="col">
                    {t.statusNames[s] ?? s.replace("_", " ")}
                  </th>
                ))}
                <th scope="col">{t.total}</th>
              </tr>
            </thead>
            <tbody>
              {TRACK_IDS.map((tr) => (
                <tr key={tr}>
                  <th scope="row">{t.trackNames[tr]}</th>
                  {statuses.map((s) => (
                    <td key={s}>{ev.filter((e) => e.track === tr && e.status === s).length}</td>
                  ))}
                  <td>
                    <b>{ev.filter((e) => e.track === tr).length}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="cov-todo">
        <h2 id="cov-todo" style={{ font: "500 20px/28px var(--font-display)", margin: "0 0 8px" }}>{t.evToResearch(research.length)}</h2>
        <p className="zq-meta">{t.evToResearchNote}</p>
        <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
          {research.map((r) => (
            <li key={r.ref} className="pp-card">
              {link(r.range)} <b {...englishContent(locale)}>{r.label}</b>
              <span className="zq-meta" style={{ display: "block" }} {...englishContent(locale)}>
                {NAME.get(r.range.surah)} · {r.why}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cov-un">
        <h2 id="cov-un" style={{ font: "500 20px/28px var(--font-display)", margin: "0 0 8px" }}>{t.evUncovered}</h2>
        <p>{cov.uncoveredRanges.length ? cov.uncoveredRanges.map(link) : t.none}</p>
      </section>

      <section aria-labelledby="cov-surah">
        <h2 id="cov-surah" style={{ font: "500 20px/28px var(--font-display)", margin: "0 0 8px" }}>{t.evBySurah}</h2>
        <div className="zq-table-scroll" role="region" aria-label={t.evBySurah} tabIndex={0}>
          <table className="tl-admin-table" style={{ minWidth: 420 }}>
            <thead>
              <tr>
                <th scope="col">{t.surah}</th>
                <th scope="col">{t.narrativeAyat}</th>
                <th scope="col">{t.covered2}</th>
                <th scope="col">{t.notCovered}</th>
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
        <h2 id="cov-excl" style={{ font: "500 20px/28px var(--font-display)", margin: "0 0 8px" }}>{t.evExcluded}</h2>
        <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
          {narrative.reviewedNotCounted.map((r) => (
            <li key={r.ref} className="pp-card">
              {link(parseRef(r.ref)!)} <b {...englishContent(locale)}>{r.label}</b>
              <span className="zq-meta" style={{ display: "block" }} {...englishContent(locale)}>
                {r.reason}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
