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

/**
 * Story coverage, for editorial staff only. Every figure is computed from the records by staff-only database
 * functions (docs/STORY_COVERAGE.md); nothing is a checkbox, and a title existing never counts as coverage.
 */
export const metadata = { title: "Story coverage" };
export const dynamic = "force-dynamic";

const NAME = new Map((surahs as Array<{ number: number; name: string }>).map((s) => [s.number, s.name]));
const h2 = { font: "500 20px/28px var(--font-display)", margin: "0 0 8px" } as const;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "0%");
const refLink = (r: Ref) => (
  <Link key={formatRef(r)} href={`/quran/${r.surah}#ayah-${r.from}${r.to > r.from ? `-${r.to}` : ""}`} className="zq-chip" style={{ marginInlineEnd: 6 }}>
    <span dir="ltr">{formatRef(r)}</span>
  </Link>
);
const yes = (b: boolean) => (b ? "Yes" : "No");

function SubjectTable({ rows, label }: { rows: SubjectRow[]; label: string }) {
  return (
    <div className="zq-table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="tl-admin-table" style={{ minWidth: 1100 }}>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Status</th>
            <th scope="col">Verses (verified / indexed)</th>
            <th scope="col">Claims (approved / all)</th>
            <th scope="col">Hadith (verified / linked)</th>
            <th scope="col">Chapters (drafted / approved / published)</th>
            <th scope="col">Sections (drafted / approved / published)</th>
            <th scope="col">Reviewed EN / AR / UR</th>
            <th scope="col">Media approved</th>
            <th scope="col">Needs re-review</th>
            <th scope="col">Researched</th>
            <th scope="col">Reviewed</th>
            <th scope="col">Published</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.event_id} data-testid="coverage-row" data-slug={r.slug}>
              <th scope="row">
                <Link href={`/events/${r.slug}`}>{r.title}</Link>
              </th>
              <td>{r.status.replace("_", " ")}</td>
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

export default async function StoryCoveragePage() {
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const staff = roles.some((r) => r === "editor" || r === "scholarly_reviewer" || r === "admin");
  if (!sb) return <EmptyState title="The story coverage report needs the database." />;
  if (!staff) return <EmptyState title="Story coverage is for editorial staff." />;

  const [subjectsRes, refsRes, inputsRes, queueRes, correctionsRes] = await Promise.all([
    sb.rpc("story_coverage_by_subject"),
    sb.rpc("story_coverage_refs"),
    sb.rpc("story_check_inputs"),
    sb.rpc("story_needs_rereview"),
    sb.from("correction_requests").select("id, entity_type, entity_id, created_at").eq("status", "open").in("entity_type", ["story", "chapter", "story_section", "event"]).limit(100),
  ]);
  if (subjectsRes.error || refsRes.error || inputsRes.error)
    return <EmptyState title="The story coverage report could not be loaded.">{subjectsRes.error?.message ?? refsRes.error?.message ?? inputsRes.error?.message}</EmptyState>;

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
        <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Story coverage</h1>
        <p className="zq-meta">
          How far the stories of the prophets, people, communities and events have come, computed from the records each time this page loads. There are no checkboxes, and a title existing is never counted as coverage: discovered, researched,
          reviewed and published are four separate counts. Every metric and its source: <code>docs/STORY_COVERAGE.md</code>. Event research coverage of the Quran text: <Link href="/admin/events/coverage">Event coverage</Link>.
        </p>
      </div>

      <section className="pp-card" aria-labelledby="cov-four">
        <h2 id="cov-four" style={h2}>
          Items: discovered, researched, reviewed, published
        </h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          <li>
            Discovered (the item is in the register): <b data-testid="cov-discovered">{four.discovered}</b>
          </li>
          <li>
            Researched (verse references and claims gathered, any status): <b data-testid="cov-researched">{four.researched}</b>
          </li>
          <li>
            Reviewed (a scholar approved a chapter or section of it, or the item itself): <b data-testid="cov-reviewed">{four.reviewed}</b>
          </li>
          <li>
            Published (the item and a part of its story are public): <b data-testid="cov-published">{four.published}</b>
          </li>
        </ul>
        {!hasData ? <p className="zq-meta">No register items were found in the database.</p> : null}
        <div className="zq-table-scroll" role="region" aria-label="Items per track" tabIndex={0}>
          <table className="tl-admin-table" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th scope="col">Track</th>
                <th scope="col">Discovered</th>
                <th scope="col">Researched</th>
                <th scope="col">Reviewed</th>
                <th scope="col">Published</th>
              </tr>
            </thead>
            <tbody>
              {TRACK_IDS.map((t) => {
                const f = fourCounts(rows.filter((r) => r.track === t));
                return (
                  <tr key={t}>
                    <th scope="row">{t}</th>
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
          Quran passages indexed
        </h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          <li>
            Narrative register (inventory plus ranges still to research): <b>{quran.register.narrative}</b> ayat
          </li>
          <li>
            Covered by the inventory file: <b>{quran.inventory.covered}</b> ({quran.inventory.percent}%)
          </li>
          <li>
            Indexed by a verse reference in the database: <b data-testid="cov-indexed">{quran.indexed.covered}</b> ({quran.indexed.percent}% of the register)
          </li>
          <li>
            Of those, resting on an approved claim: <b data-testid="cov-verified-ayat">{quran.verified.covered}</b> ({pct(quran.verified.covered, quran.register.narrative)})
          </li>
          <li>
            Verse references: <b>{sum(rows, "verse_refs")}</b> indexed, <b>{sum(rows, "verse_refs_verified")}</b> verified
          </li>
        </ul>
        <p className="zq-meta">&ldquo;Narrative&rdquo; is an editorial judgement, so these are shares of the register, not proof of completeness.</p>
      </section>

      <section className="pp-card" aria-labelledby="cov-evidence">
        <h2 id="cov-evidence" style={h2}>
          Evidence, chapters, translations, media
        </h2>
        <div className="zq-table-scroll" role="region" aria-label="Totals" tabIndex={0}>
          <table className="tl-admin-table" style={{ minWidth: 420 }}>
            <tbody>
              {(
                [
                  ["Claims approved / all", `${sum(rows, "claims_approved")} / ${sum(rows, "claims")}`],
                  ["Hadith links verified (named sahih or hasan grading, four collections) / linked", `${sum(rows, "hadith_verified")} / ${sum(rows, "hadith_links")}`],
                  ["Chapters drafted", sum(rows, "chapters_drafted")],
                  ["Chapters scholar-approved (this version)", sum(rows, "chapters_reviewed")],
                  ["Chapters published", sum(rows, "chapters_published")],
                  ["Story sections drafted / approved / published (of " + sections + ")", `${sum(rows, "sections_drafted")} / ${sum(rows, "sections_reviewed")} / ${sum(rows, "sections_published")}`],
                  ["EN scripts reviewed and published", sum(rows, "scripts_en")],
                  ["AR translations reviewed and published", sum(rows, "scripts_ar")],
                  ["UR translations reviewed and published", sum(rows, "scripts_ur")],
                  ["Translations awaiting review or publication", sum(rows, "translations_pending")],
                  ["Media approved", sum(rows, "media_approved")],
                  ["Needs re-review (source changed)", queue.length],
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
          The {prophets.length} prophets
        </h2>
        <SubjectTable rows={prophets} label="Prophets" />
      </section>

      {TRACK_IDS.filter((t) => t !== "prophets").map((t) => {
        const list = rows.filter((r) => r.track === t);
        return (
          <details key={t}>
            <summary>
              <b>{t}</b> ({list.length})
            </summary>
            <SubjectTable rows={list} label={t} />
          </details>
        );
      })}

      <section aria-labelledby="cov-open">
        <h2 id="cov-open" style={h2}>
          Unresolved questions
        </h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          <li>
            Points chapters record as not established by the sources: <b>{unknowns.length}</b>
          </li>
          <li>
            Open correction requests on stories, chapters, sections and events: <b>{corrections.length}</b> (<Link href="/admin/corrections">Corrections</Link>)
          </li>
          <li>
            Dependants waiting for a fresh review after a source changed: <b>{queue.length}</b> (<Link href="/admin/stories">Needs re-review</Link>)
          </li>
          <li>
            Narrative ranges still to research: <b>{research.length}</b>
          </li>
        </ul>
        {unknowns.length ? (
          <ul style={{ display: "grid", gap: 8, margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {unknowns.map((c) => (
              <li key={c.id} className="pp-card">
                <b>
                  {c.storySlug}#{c.anchor}
                </b>{" "}
                <span className="zq-meta">({c.status})</span>
                <span style={{ display: "block", whiteSpace: "pre-wrap" }}>{c.unknownsMd}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <details style={{ marginTop: 8 }}>
          <summary>Ranges to research ({research.length})</summary>
          <ul style={{ display: "grid", gap: 6, margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {research.map((r) => (
              <li key={r.ref} className="pp-card">
                {refLink(r.range)} <b>{r.label}</b>
                <span className="zq-meta" style={{ display: "block" }}>
                  {NAME.get(r.range.surah)} · {r.why}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section aria-labelledby="cov-checks" data-testid="story-checks">
        <h2 id="cov-checks" style={h2}>
          Automated checks
        </h2>
        <p className="zq-meta">
          The same checks run in CI and from the command line (<code>pnpm check:stories</code>). They report; they never change anything. {db ? "Database and content files." : "Content files only: the database inputs were not available."}
        </p>
        <p>
          <b data-testid="check-errors">{summary.errors}</b> error(s), <b data-testid="check-warnings">{summary.warnings}</b> warning(s), {summary.total - summary.errors - summary.warnings} note(s).
        </p>
        <div className="zq-table-scroll" role="region" aria-label="Checks" tabIndex={0}>
          <table className="tl-admin-table" style={{ minWidth: 480 }}>
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">Errors</th>
                <th scope="col">Warnings</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {CHECKS.map((c) => (
                <tr key={c.id}>
                  <th scope="row">{c.title}</th>
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
            <summary>Findings ({findings.length})</summary>
            <ul style={{ display: "grid", gap: 6, margin: "8px 0 0", padding: 0, listStyle: "none" }}>
              {findings.slice(0, 300).map((f, i) => (
                <li key={i} className="pp-card" data-severity={f.severity}>
                  <b>{f.severity}</b> · {CHECKS.find((c) => c.id === f.check)?.title} · <span dir="auto">{f.subject}</span>
                  <span className="zq-meta" style={{ display: "block" }}>
                    {f.message}
                  </span>
                </li>
              ))}
            </ul>
            {findings.length > 300 ? <p className="zq-meta">Showing the first 300 of {findings.length}; run the command line check for the full list.</p> : null}
          </details>
        ) : (
          <p className="zq-meta">No findings.</p>
        )}
      </section>
    </div>
  );
}
