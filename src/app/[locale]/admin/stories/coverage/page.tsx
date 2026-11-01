import Link from "next/link";
import "@/styles/timeline.css";
import narrative from "@content/events/narrative-ranges.json";
import surahs from "@content/quran/surahs.json";
import { EmptyState } from "@/components/ui/misc";
import { rolesOf } from "@/lib/admin";
import { formatRef, parseRef, type Ref } from "@/lib/events/verify";
import { TRACK_IDS } from "@/lib/events/tracks";
import { getUser } from "@/lib/supabase/server";
import { CHECKS, runChecks, summarise, type DbInputs } from "@/lib/stories/checks";
import { fourCounts, quranCoverage, sum, type IndexedRef, type SubjectRow } from "@/lib/stories/coverage";
import { loadContentInputs } from "@/lib/stories/static-inputs";
import type { Metadata } from "next";
import { englishContent } from "@/lib/i18n/locales";
import { adminStrings } from "@/lib/i18n/modules/admin";
import { adminCoverageStrings } from "@/lib/i18n/modules/adminCoverage";

/**
 * Story coverage, for editorial staff only. Every figure is computed from the records by staff-only database
 * functions (docs/STORY_COVERAGE.md); nothing is a checkbox, and a title existing never counts as coverage.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: adminStrings((await params).locale).nav["/admin/stories/coverage"] };
}
export const dynamic = "force-dynamic";

const NAME = new Map((surahs as Array<{ number: number; name: string }>).map((s) => [s.number, s.name]));
const h2 = { font: "500 20px/28px var(--font-display)", margin: "0 0 8px" } as const;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "0%");
const refLink = (r: Ref) => (
  <Link key={formatRef(r)} href={`/quran/${r.surah}#ayah-${r.from}${r.to > r.from ? `-${r.to}` : ""}`} className="zq-chip" style={{ marginInlineEnd: 6 }}>
    <span dir="ltr">{formatRef(r)}</span>
  </Link>
);

function SubjectTable({ rows, label, t, locale }: { rows: SubjectRow[]; label: string; t: ReturnType<typeof adminCoverageStrings>; locale: string }) {
  const yes = (b: boolean) => (b ? t.yesCap : t.noCap);
  return (
    <div className="zq-table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="tl-admin-table" style={{ minWidth: 1100 }}>
        <thead>
          <tr>
            <th scope="col">{t.colItem}</th>
            <th scope="col">{t.colStatus}</th>
            <th scope="col">{t.colVerses}</th>
            <th scope="col">{t.colClaims}</th>
            <th scope="col">{t.colHadith}</th>
            <th scope="col">{t.colChapters}</th>
            <th scope="col">{t.colSections}</th>
            <th scope="col">{t.colScripts}</th>
            <th scope="col">{t.colMedia}</th>
            <th scope="col">{t.colRereview}</th>
            <th scope="col">{t.colResearched}</th>
            <th scope="col">{t.colReviewed}</th>
            <th scope="col">{t.colPublished}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.event_id} data-testid="coverage-row" data-slug={r.slug}>
              <th scope="row">
                <Link href={`/events/${r.slug}`} {...englishContent(locale)}>{r.title}</Link>
              </th>
              <td>{t.statusNames[r.status] ?? r.status.replace("_", " ")}</td>
              <td>
                {r.verse_refs_verified} / {r.verse_refs}
              </td>
              <td>
                {r.claims_approved} / {r.claims}
              </td>
              <td>
                {r.hadith_verified} / {r.hadith_links}
              </td>
              <td>
                {r.chapters_drafted} / {r.chapters_reviewed} / {r.chapters_published}
              </td>
              <td>
                {r.sections_drafted} / {r.sections_reviewed} / {r.sections_published}
              </td>
              <td>
                {r.scripts_en} / {r.scripts_ar} / {r.scripts_ur}
              </td>
              <td>{r.media_approved}</td>
              <td>{r.needs_review}</td>
              <td>{yes(r.researched)}</td>
              <td>{yes(r.reviewed)}</td>
              <td>{yes(r.published)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function StoryCoveragePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = adminCoverageStrings(locale);
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const staff = roles.some((r) => r === "editor" || r === "scholarly_reviewer" || r === "admin");
  if (!sb) return <EmptyState title={t.stNeedsDb} />;
  if (!staff) return <EmptyState title={t.stStaffOnly} />;

  const [subjectsRes, refsRes, inputsRes, queueRes, correctionsRes] = await Promise.all([
    sb.rpc("story_coverage_by_subject"),
    sb.rpc("story_coverage_refs"),
    sb.rpc("story_check_inputs"),
    sb.rpc("story_needs_rereview"),
    sb.from("correction_requests").select("id, entity_type, entity_id, created_at").eq("status", "open").in("entity_type", ["story", "chapter", "story_section", "event"]).limit(100),
  ]);
  if (subjectsRes.error || refsRes.error || inputsRes.error)
    return <EmptyState title={t.stLoadFail}>
        <span lang="en" dir="ltr">
          {subjectsRes.error?.message ?? refsRes.error?.message ?? inputsRes.error?.message}
        </span>
      </EmptyState>;

  const rows = (subjectsRes.data ?? []) as SubjectRow[];
  const refs = (refsRes.data ?? []) as IndexedRef[];
  const db = (inputsRes.data ?? null) as DbInputs | null;
  const queue = (queueRes.data ?? []) as Array<{ dependant_type: string }>;
  const corrections = (correctionsRes.data ?? []) as Array<{ id: string; entity_type: string }>;

  const content = loadContentInputs(process.cwd(), db);
  const research = narrative.toResearch.map((r) => ({ ...r, range: parseRef(r.ref)! }));
  const inventoryRefs = content.inventory.flatMap((i) => i.refs.map((r) => parseRef(r)).filter((r): r is Ref => !!r));
  const quran = quranCoverage(refs, inventoryRefs, research.map((r) => r.range));
  const four = fourCounts(rows);
  const findings = runChecks({ content, db });
  const summary = summarise(findings);
  const prophets = rows.filter((r) => r.track === "prophets");
  const unknowns = (db?.chapters ?? []).filter((c) => c.unknownsMd?.trim());
  const sections = sum(rows, "sections");
  const hasData = rows.length > 0;

  return (
    <div style={{ display: "grid", gap: 24 }} data-testid="story-coverage">
      <div>
        <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{t.stTitle}</h1>
        <p className="zq-meta">
          {t.stLeadA} <code>docs/STORY_COVERAGE.md</code>. {t.stLeadB} <Link href="/admin/events/coverage">{t.stEventCoverage}</Link>.
        </p>
      </div>

      <section className="pp-card" aria-labelledby="cov-four">
        <h2 id="cov-four" style={h2}>
          {t.stFour}
        </h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          <li>
            {t.stDiscovered} <b data-testid="cov-discovered">{four.discovered}</b>
          </li>
          <li>
            {t.stResearched} <b data-testid="cov-researched">{four.researched}</b>
          </li>
          <li>
            {t.stReviewed} <b data-testid="cov-reviewed">{four.reviewed}</b>
          </li>
          <li>
            {t.stPublished} <b data-testid="cov-published">{four.published}</b>
          </li>
        </ul>
        {!hasData ? <p className="zq-meta">{t.stNoItems}</p> : null}
        <div className="zq-table-scroll" role="region" aria-label={t.stPerTrack} tabIndex={0}>
          <table className="tl-admin-table" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th scope="col">{t.track}</th>
                <th scope="col">{t.colDiscovered}</th>
                <th scope="col">{t.colResearched}</th>
                <th scope="col">{t.colReviewed}</th>
                <th scope="col">{t.colPublished}</th>
              </tr>
            </thead>
            <tbody>
              {TRACK_IDS.map((tr) => {
                const f = fourCounts(rows.filter((r) => r.track === tr));
                return (
                  <tr key={tr}>
                    <th scope="row">{t.trackNames[tr]}</th>
                    <td>{f.discovered}</td>
                    <td>{f.researched}</td>
                    <td>{f.reviewed}</td>
                    <td>{f.published}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pp-card" aria-labelledby="cov-quran">
        <h2 id="cov-quran" style={h2}>
          {t.stQuran}
        </h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          <li>
            {t.stRegister} <b>{quran.register.narrative}</b> {t.ayat}
          </li>
          <li>
            {t.stCoveredInv} <b>{quran.inventory.covered}</b> ({quran.inventory.percent}%)
          </li>
          <li>
            {t.stIndexed} <b data-testid="cov-indexed">{quran.indexed.covered}</b> ({quran.indexed.percent}% {t.ofRegister})
          </li>
          <li>
            {t.stVerifiedAyat} <b data-testid="cov-verified-ayat">{quran.verified.covered}</b> ({pct(quran.verified.covered, quran.register.narrative)})
          </li>
          <li>
            {t.stVerseRefs} <b>{sum(rows, "verse_refs")}</b> {t.indexedCount} <b>{sum(rows, "verse_refs_verified")}</b> {t.verifiedCount}
          </li>
        </ul>
        <p className="zq-meta">{t.stNarrativeNote}</p>
      </section>

      <section className="pp-card" aria-labelledby="cov-evidence">
        <h2 id="cov-evidence" style={h2}>
          {t.stEvidence}
        </h2>
        <div className="zq-table-scroll" role="region" aria-label={t.totals} tabIndex={0}>
          <table className="tl-admin-table" style={{ minWidth: 420 }}>
            <tbody>
              {(
                [
                  [t.tot.claims!, `${sum(rows, "claims_approved")} / ${sum(rows, "claims")}`],
                  [t.tot.hadith!, `${sum(rows, "hadith_verified")} / ${sum(rows, "hadith_links")}`],
                  [t.tot.chDrafted!, sum(rows, "chapters_drafted")],
                  [t.tot.chReviewed!, sum(rows, "chapters_reviewed")],
                  [t.tot.chPublished!, sum(rows, "chapters_published")],
                  [t.tot.sections! + t.sectionsOf(sections), `${sum(rows, "sections_drafted")} / ${sum(rows, "sections_reviewed")} / ${sum(rows, "sections_published")}`],
                  [t.tot.en!, sum(rows, "scripts_en")],
                  [t.tot.ar!, sum(rows, "scripts_ar")],
                  [t.tot.ur!, sum(rows, "scripts_ur")],
                  [t.tot.pending!, sum(rows, "translations_pending")],
                  [t.tot.media!, sum(rows, "media_approved")],
                  [t.tot.rereview!, queue.length],
                ] as Array<[string, string | number]>
              ).map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>
                    <b>{v}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="cov-prophets">
        <h2 id="cov-prophets" style={h2}>
          {t.stProphets(prophets.length)}
        </h2>
        <SubjectTable rows={prophets} label={t.prophets} t={t} locale={locale} />
      </section>

      {TRACK_IDS.filter((tr) => tr !== "prophets").map((tr) => {
        const list = rows.filter((r) => r.track === tr);
        return (
          <details key={tr}>
            <summary>
              <b>{t.trackNames[tr]}</b> ({list.length})
            </summary>
            <SubjectTable rows={list} label={t.trackNames[tr]!} t={t} locale={locale} />
          </details>
        );
      })}

      <section aria-labelledby="cov-open">
        <h2 id="cov-open" style={h2}>
          {t.stOpen}
        </h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          <li>
            {t.stUnknowns} <b>{unknowns.length}</b>
          </li>
          <li>
            {t.stCorrections} <b>{corrections.length}</b> (<Link href="/admin/corrections">{t.correctionsLink}</Link>)
          </li>
          <li>
            {t.stRereview} <b>{queue.length}</b> (<Link href="/admin/stories">{t.needsRereviewLink}</Link>)
          </li>
          <li>
            {t.stRangesLeft} <b>{research.length}</b>
          </li>
        </ul>
        {unknowns.length ? (
          <ul style={{ display: "grid", gap: 8, margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {unknowns.map((c) => (
              <li key={c.id} className="pp-card">
                <b>
                  <span {...englishContent(locale)}>{c.storySlug}#{c.anchor}</span>
                </b>{" "}
                <span className="zq-meta">({t.statusNames[c.status] ?? c.status})</span>
                <span style={{ display: "block", whiteSpace: "pre-wrap" }} {...englishContent(locale)}>{c.unknownsMd}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <details style={{ marginTop: 8 }}>
          <summary>{t.stRangesTo(research.length)}</summary>
          <ul style={{ display: "grid", gap: 6, margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {research.map((r) => (
              <li key={r.ref} className="pp-card">
                {refLink(r.range)} <b {...englishContent(locale)}>{r.label}</b>
                <span className="zq-meta" style={{ display: "block" }} {...englishContent(locale)}>
                  {NAME.get(r.range.surah)} · {r.why}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section aria-labelledby="cov-checks" data-testid="story-checks">
        <h2 id="cov-checks" style={h2}>
          {t.stChecks}
        </h2>
        <p className="zq-meta">
          {t.stChecksA}<code>pnpm check:stories</code>{t.stChecksB} {db ? t.stDbAndContent : t.stContentOnly}
        </p>
        <p>
          <b data-testid="check-errors">{summary.errors}</b> {t.errorsWord} <b data-testid="check-warnings">{summary.warnings}</b> {t.warningsWord} {summary.total - summary.errors - summary.warnings} {t.notesWord}
        </p>
        <div className="zq-table-scroll" role="region" aria-label={t.checksLabel} tabIndex={0}>
          <table className="tl-admin-table" style={{ minWidth: 480 }}>
            <thead>
              <tr>
                <th scope="col">{t.colCheck}</th>
                <th scope="col">{t.colErrors}</th>
                <th scope="col">{t.colWarnings}</th>
                <th scope="col">{t.colNotes}</th>
              </tr>
            </thead>
            <tbody>
              {CHECKS.map((c) => (
                <tr key={c.id}>
                  <th scope="row" {...englishContent(locale)}>{c.title}</th>
                  <td>{summary.by[c.id].error}</td>
                  <td>{summary.by[c.id].warning}</td>
                  <td>{summary.by[c.id].info}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {findings.length ? (
          <details open={summary.errors > 0}>
            <summary>{t.findings(findings.length)}</summary>
            <ul style={{ display: "grid", gap: 6, margin: "8px 0 0", padding: 0, listStyle: "none" }}>
              {findings.slice(0, 300).map((f, i) => (
                <li key={i} className="pp-card" data-severity={f.severity}>
                  <b>{t.severities[f.severity] ?? f.severity}</b> · <span {...englishContent(locale)}>{CHECKS.find((c) => c.id === f.check)?.title}</span> · <span dir="auto">{f.subject}</span>
                  <span className="zq-meta" style={{ display: "block" }} {...englishContent(locale)}>
                    {f.message}
                  </span>
                </li>
              ))}
            </ul>
            {findings.length > 300 ? <p className="zq-meta">{t.showingFirst(300, findings.length)}</p> : null}
          </details>
        ) : (
          <p className="zq-meta">{t.noFindings}</p>
        )}
      </section>
    </div>
  );
}
