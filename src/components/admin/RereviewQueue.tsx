"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

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

const LABEL: Record<string, string> = {
  chapter: "Chapter",
  story: "Story summary",
  story_section: "Story section",
  quiz: "Quiz",
  media: "Media",
  story_script: "Script or translation",
  narration_audio: "Audio",
};

/**
 * "Needs re-review": everything built from a source that changed after it was reviewed or published (a claim, a
 * reference, a hadith grading, a commentary link, an event's verse references). The published text stays as it was,
 * frozen, until it is corrected and a scholar approves it again.
 */
export function RereviewQueue() {
  const sb = getBrowserSupabase();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!sb) return setError("Not configured");
    const { data, error: e } = await sb.rpc("story_needs_rereview");
    if (e) setError(e.message);
    else setRows((data ?? []) as Row[]);
  }, [sb]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="pp-card" aria-labelledby="rq-h" data-testid="rereview-queue">
      <h2 id="rq-h" style={{ font: "500 22px/30px var(--font-display)", margin: 0 }}>
        Needs re-review {rows ? `(${rows.length})` : ""}
      </h2>
      <p className="zq-meta">
        Content whose sources changed after it was reviewed. What readers see is unchanged until it is corrected and approved again by a scholar (not its author).
      </p>
      {error ? (
        <p role="alert" className="zq-error">
          {error}
        </p>
      ) : rows === null ? (
        <p className="zq-meta">Loading…</p>
      ) : rows.length ? (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <li key={`${r.dependant_type}:${r.dependant_id}`} className="zq-result" style={{ gap: 4 }}>
              <span>
                <b>{LABEL[r.dependant_type] ?? r.dependant_type}</b>: {r.title ?? r.dependant_id}{" "}
                <span className="zq-order">{r.status}</span>
              </span>
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                {r.reasons.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <span className="zq-meta">
                Flagged {r.flagged_at ? new Date(r.flagged_at).toISOString().slice(0, 16).replace("T", " ") + " UTC" : ""} · {r.sources} source change(s) ·{" "}
                <Link href="/admin/review">Review queue</Link>
                {r.story_slug ? (
                  <>
                    {" "}
                    · <Link href={`/stories/${r.story_slug}`}>Public page</Link>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="zq-meta" data-testid="rereview-empty">
          Nothing needs re-review.
        </p>
      )}
    </section>
  );
}
