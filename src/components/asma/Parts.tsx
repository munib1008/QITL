import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/asma.css";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import type { CountSummary, Measure, NameListItem } from "@/lib/asma/model";

/**
 * "AI Draft — Under Review": the label every public Asma' al-Husna page that shows AI-written, unreviewed material carries.
 * It is never replaced by a "verified" mark: only a published, scholar-approved record shows "Reviewed".
 */
export function isAiDraft(n: Pick<NameListItem, "ai_generated" | "published" | "scholarly_status">): boolean {
  return !(n.published && n.scholarly_status === "approved") && n.ai_generated !== false;
}

export function AiDraftBanner({ locale, status }: { locale: string; status?: string }) {
  const s = asmaStrings(locale).aiDraft;
  return (
    <aside className="as-draft" role="note" aria-label={s.badge} data-testid="ai-draft-banner" data-status={status ?? "not_reviewed"}>
      <b>{s.badge}</b>
      <p>{s.body}</p>
    </aside>
  );
}

export function AiDraftBadge({ locale, reviewed }: { locale: string; reviewed?: boolean }) {
  const s = asmaStrings(locale).aiDraft;
  return (
    <span className="as-badge" data-state={reviewed ? "reviewed" : "ai-draft"} data-testid="ai-draft-badge">
      {reviewed ? s.reviewed : s.badge}
    </span>
  );
}

/** What an unfilled section says: that it is unavailable, and why. Never filler. */
export function Unavailable({ locale, children }: { locale: string; children?: ReactNode }) {
  const s = asmaStrings(locale).name;
  return (
    <div className="as-unavailable" data-testid="unavailable">
      <b>{s.unavailable}</b>
      <span>{children ?? s.awaitingSource}</span>
    </div>
  );
}

export function Section({ id, letter, title, children }: { id: string; letter?: string; title: string; children: ReactNode }) {
  return (
    <section className="as-section" aria-labelledby={`${id}-h`} id={id}>
      <h2 id={`${id}-h`}>
        {letter ? (
          <span className="as-letter" aria-hidden="true">
            {letter}
          </span>
        ) : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

const ORDER: Measure[] = ["A", "B", "C"];

/** The three measures side by side, each with its own number. There is no total, by design. */
export function MeasureCards({ locale, summary }: { locale: string; summary: CountSummary | null }) {
  const m = asmaStrings(locale).measures;
  return (
    <div className="as-measures" data-testid="measures" role="group" aria-label={m.heading}>
      {ORDER.map((k) => {
        const x = summary?.measures[k];
        return (
          <div key={k} className="as-measure" data-measure={k} data-testid={`measure-${k}`}>
            <h3>{m[k].name}</h3>
            <span className="as-num" dir="ltr">
              {x ? m.count(x.count) : "—"}
            </span>
            <p>{x ? (x.count === 0 ? m.none : m.verses(x.verses)) : m.notComputed}</p>
            {x?.stale ? <p>{m.stale}</p> : null}
            <p>{m[k].note}</p>
          </div>
        );
      })}
    </div>
  );
}

export function Provenance({ locale, summary }: { locale: string; summary: CountSummary | null }) {
  const m = asmaStrings(locale).measures;
  if (!summary) return null;
  return (
    <dl className="as-prov" data-testid="provenance">
      <dt>{m.methodology}</dt>
      <dd dir="ltr">{summary.methodology}</dd>
      <dt>{m.edition}</dt>
      <dd dir="ltr">{`${summary.edition.source} ${summary.edition.version}`}</dd>
      <dt>{m.checksum}</dt>
      <dd dir="ltr">
        <code>{summary.edition.sha256}</code>
      </dd>
      <dt>{m.normalisation}</dt>
      <dd dir="ltr">{summary.normalisation}</dd>
      <dt>{m.tokenisation}</dt>
      <dd dir="ltr">{summary.tokenisation}</dd>
      <dt>{m.query}</dt>
      <dd dir="ltr">{summary.queryVersion}</dd>
      {(["A", "B", "C"] as const).map((k) =>
        summary.measures[k] ? (
          <div key={k} style={{ display: "contents" }}>
            <dt>{`${m.queryHash} ${k}`}</dt>
            <dd dir="ltr">
              <code>{summary.measures[k]!.queryHash}</code>
            </dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}

export function NameLink({ slug, children }: { slug: string; children: ReactNode }) {
  return <Link href={`/asma/${slug}`}>{children}</Link>;
}
