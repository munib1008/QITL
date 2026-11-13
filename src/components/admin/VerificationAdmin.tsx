"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useLocale } from "@/lib/i18n/useLocale";
import { adminVerificationStrings } from "@/lib/i18n/modules/adminVerification";

interface Row {
  slug: string;
  title: string;
  status: string;
  visibility: string;
  integrity_status: string;
  scholarly_status: string;
}

/**
 * Read-only status console: counts and a filterable list of every story's three separate states (visibility, source integrity,
 * scholarly review) from the records. It cannot approve or publish anything; reviews are made in the review queue by an
 * appointed reviewer, and nothing here can produce a Verified state.
 */
export function VerificationAdmin() {
  const sb = getBrowserSupabase();
  const locale = useLocale();
  const t = useMemo(() => adminVerificationStrings(locale), [locale]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [reviews, setReviews] = useState<number | null>(null);
  const [science, setScience] = useState<number | "n/a" | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!sb) return;
    let live = true;
    (async () => {
      const [s, r, sc] = await Promise.all([
        sb.from("stories").select("slug, title, status, visibility, integrity_status, scholarly_status").order("title").limit(1000),
        sb.from("editorial_reviews").select("id", { count: "exact", head: true }),
        sb.from("science_topics").select("id", { count: "exact", head: true }),
      ]);
      if (!live) return;
      if (s.error) return setError(true);
      setRows((s.data ?? []) as Row[]);
      setReviews(r.error ? null : (r.count ?? 0));
      setScience(sc.error ? "n/a" : (sc.count ?? 0));
    })();
    return () => {
      live = false;
    };
  }, [sb]);

  if (!sb) return <EmptyState title={t.needsDb} />;
  if (error) return <EmptyState title={t.loadError} />;
  if (!rows) return <Skeleton height={160} />;

  const count = (f: (r: Row) => boolean) => rows.filter(f).length;
  const cards: Array<[string, number | string]> = [
    [t.total, rows.length],
    [t.publicDrafts, count((r) => r.visibility === "public_ai_draft")],
    [t.integrityFailed, count((r) => r.integrity_status === "failed" || r.integrity_status === "needs_investigation")],
    [t.integrityPending, count((r) => r.integrity_status === "pending")],
    [t.awaiting, count((r) => r.scholarly_status === "not_reviewed" || r.scholarly_status === "under_review")],
    [t.changes, count((r) => r.scholarly_status === "changes_requested")],
    [t.approved, count((r) => r.scholarly_status === "approved")],
    [t.published, count((r) => r.status === "published")],
    [t.reviewsRecorded, reviews ?? "—"],
  ];
  const shown = filter === "all" ? rows : rows.filter((r) => r.scholarly_status === filter);
  return (
    <div style={{ display: "grid", gap: 20 }} data-testid="verification-console">
      <section aria-labelledby="vc-sum">
        <h2 id="vc-sum">{t.summary}</h2>
        <ul className="vf-counts" data-testid="vc-counts">
          {cards.map(([label, n]) => (
            <li key={label}>
              <span>{label}</span>
              <b dir="ltr">{n}</b>
            </li>
          ))}
          <li>
            <span>{t.scienceTopics}</span>
            <b dir="ltr">{science === "n/a" || science === null ? "—" : science}</b>
          </li>
        </ul>
        {reviews === 0 ? (
          <p className="zq-meta" data-testid="vc-no-reviews">
            {t.noReviewers}
          </p>
        ) : null}
        {science === "n/a" ? <p className="zq-meta">{t.scienceNotApplied}</p> : null}
      </section>
      <section aria-labelledby="vc-list">
        <div className="zq-field" style={{ maxWidth: 280 }}>
          <label htmlFor="vc-filter">{t.filter}</label>
          <select id="vc-filter" className="zq-input" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">{t.all}</option>
            {Object.entries(t.statusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <p className="zq-meta" aria-live="polite">
          {t.showing(shown.length, rows.length)}
        </p>
        {shown.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="zq-table" data-testid="vc-table">
              <thead>
                <tr>
                  <th scope="col">{t.columns.story}</th>
                  <th scope="col">{t.columns.visibility}</th>
                  <th scope="col">{t.columns.integrity}</th>
                  <th scope="col">{t.columns.review}</th>
                  <th scope="col">{t.columns.open}</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 300).map((r) => (
                  <tr key={r.slug}>
                    <th scope="row">{r.title}</th>
                    <td>{t.visibilityLabels[r.visibility] ?? r.visibility}</td>
                    <td>{t.integrityLabels[r.integrity_status] ?? r.integrity_status}</td>
                    <td>{t.statusLabels[r.scholarly_status] ?? r.scholarly_status}</td>
                    <td>
                      <Link href="/admin/stories">{t.openReview}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t.none} />
        )}
      </section>
    </div>
  );
}
