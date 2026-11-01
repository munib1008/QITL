"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useLocale } from "@/lib/i18n/useLocale";
import { englishContent } from "@/lib/i18n/locales";
import { adminLineageStrings } from "@/lib/i18n/modules/adminLineage";
import { ServerText } from "./feedback";

interface Row {
  dependant_type: string;
  dependant_id: string;
  title: string | null;
  story_slug: string | null;
  status: string | null;
  reasons: string[];
  flagged_at: string | null;
  sources: number;
}

/**
 * "Needs re-review": everything built from a source that changed after it was reviewed or published (a claim, a
 * reference, a hadith grading, a commentary link, an event's verse references). The published text stays as it was,
 * frozen, until it is corrected and a scholar approves it again.
 */
export function RereviewQueue() {
  const sb = getBrowserSupabase();
  const locale = useLocale();
  const ln = useMemo(() => adminLineageStrings(locale), [locale]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!sb) return setError(ln.notConfigured);
    const { data, error: e } = await sb.rpc("story_needs_rereview");
    if (e) setError(e.message);
    else setRows((data ?? []) as Row[]);
  }, [sb, ln]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="pp-card" aria-labelledby="rq-h" data-testid="rereview-queue">
      <h2 id="rq-h" style={{ font: "500 22px/30px var(--font-display)", margin: 0 }}>
        {ln.rrHeading} {rows ? `(${rows.length})` : ""}
      </h2>
      <p className="zq-meta">
        {ln.rrNote}
      </p>
      {error ? (
        <p role="alert" className="zq-error">
          {error === ln.notConfigured ? error : <ServerText>{error}</ServerText>}
        </p>
      ) : rows === null ? (
        <p className="zq-meta">{ln.rrLoading}</p>
      ) : rows.length ? (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <li key={`${r.dependant_type}:${r.dependant_id}`} className="zq-result" style={{ gap: 4 }}>
              <span>
                <b>{ln.rrTypes[r.dependant_type] ?? r.dependant_type}</b>: <span {...englishContent(locale)}>{r.title ?? r.dependant_id}</span>{" "}
                <span className="zq-order">{r.status}</span>
              </span>
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                {r.reasons.map((x) => (
                  <li key={x} {...englishContent(locale)}>{x}</li>
                ))}
              </ul>
              <span className="zq-meta">
                {ln.rrFlagged(r.flagged_at ? new Date(r.flagged_at).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "", r.sources)}{" "}
                <Link href="/admin/review">{ln.rrReviewQueue}</Link>
                {r.story_slug ? (
                  <>
                    {" "}
                    · <Link href={`/stories/${r.story_slug}`}>{ln.rrPublicPage}</Link>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="zq-meta" data-testid="rereview-empty">
          {ln.rrNothing}
        </p>
      )}
    </section>
  );
}
