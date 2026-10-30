import Link from "next/link";
import type { ReactNode } from "react";
import { CitationChip } from "./evidence";
import { TimelineEnhancer } from "./TimelineEnhancer";
import { cx } from "@/lib/cx";
import type { EvidenceKind } from "@/content/journey";
import { EvidenceLabel } from "./evidence";
import { PRECISION_TEXT, type DatePrecision } from "./cards";

export interface TimelineItem {
  id: string;
  title: string;
  precision?: DatePrecision;
  dateLabel?: string;
  evidence?: EvidenceKind;
  href: string;
  /** When present the stop expands in place (a native disclosure: works without JavaScript, never off screen). */
  detail?: TimelineDetail;
}
export interface TimelineDetail {
  summary?: string;
  facts: Array<[string, string]>;
  refs: Array<{ label: string; href: string }>;
  links: Array<{ label: string; href: string; primary?: boolean }>;
  badges?: ReactNode;
}
export interface TimelineEra {
  title: string;
  kind: "relative" | "dated" | "undated-future";
  note?: string;
  items: TimelineItem[];
  breakAfter?: string;
}

const MARK: Record<DatePrecision, string> = {
  exact: "zq-vt-dot",
  range: "zq-vt-bar",
  estimated: "zq-vt-bar zq-vt-est",
  relative: "zq-vt-dia",
  unknown: "zq-vt-unk",
};

/**
 * The master timeline: Adam at the top, today at the bottom. An ordered list, not a scaled axis.
 * Relative eras have no years; the brass break marks where recorded chronology begins.
 * The list itself is the keyboard and screen-reader view.
 */
export function VerticalTimeline({
  eras,
  today,
  selected,
  label = "Timeline from Adam to today",
  enhance = false,
}: {
  eras: TimelineEra[];
  today?: string | false;
  selected?: string;
  label?: string;
  /** Adds the progress bar, current-chapter highlight and jump-to-era menu (client, progressive). */
  enhance?: boolean;
}) {
  const list = (
    <section className="zq-vt" aria-label={label}>
      <p className="zq-vt-scale">Ordered from Adam to today · not to scale</p>
      <ol className="zq-vt-list">
        {eras.map((era) => (
          <li key={era.title} className={cx("zq-vt-era", `zq-vt-era-${era.kind}`)} data-era-kind={era.kind} data-era={era.title} id={`era-${slug(era.title)}`}>
            <div className="zq-vt-erahead">
              <p className="zq-eyebrow">{era.title}</p>
              <p className="zq-meta">
                {era.kind === "relative"
                  ? (era.note ?? "Relative order only — no dates are known")
                  : era.kind === "undated-future"
                    ? (era.note ?? "No date is known. Order follows the texts only.")
                    : (era.note ?? "")}
              </p>
            </div>
            <ol className="zq-vt-items">
              {era.items.map((it) => {
                const pr = it.precision ?? (era.kind === "relative" ? "relative" : "unknown");
                const sel = it.id === selected;
                return (
                  <li key={it.id} id={`stop-${it.id}`} className={cx("zq-vt-item", sel && "zq-vt-sel")} data-precision={pr} data-stop>
                    <span className={`zq-vt-mark ${MARK[pr]}`} aria-hidden="true" />
                    {it.detail ? (
                      <details className="zq-vt-det" open={sel || undefined}>
                        <summary className="zq-vt-btn" aria-current={sel || undefined}>
                          <span className="zq-vt-when">{it.dateLabel ?? PRECISION_TEXT[pr]}</span>
                          <span className="zq-vt-title">{it.title}</span>
                          {it.evidence ? <EvidenceLabel kind={it.evidence} /> : null}
                        </summary>
                        <div className="zq-vt-panel">
                          <h3 className="zq-vt-ph">{it.title}</h3>
                          {it.detail.summary ? <p>{it.detail.summary}</p> : null}
                          {it.detail.facts.length ? (
                            <dl className="zq-kv">
                              {it.detail.facts.map(([k, v]) => (
                                <div key={k} style={{ display: "contents" }}>
                                  <dt>{k}</dt>
                                  <dd>{v}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                          {it.detail.badges || it.detail.refs.length ? (
                            <div className="zq-vt-refs">
                              {it.detail.badges}
                              {it.detail.refs.map((r) => (
                                <CitationChip key={r.href} href={r.href}>
                                  {r.label}
                                </CitationChip>
                              ))}
                            </div>
                          ) : null}
                          <div className="zq-actions">
                            {it.detail.links.map((l) => (
                              <Link key={l.href} className={cx("zq-btn zq-btn-sm zq-btn-link", l.primary ? "zq-btn-primary" : "zq-btn-secondary")} href={l.href}>
                                {l.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </details>
                    ) : (
                      <Link className="zq-vt-btn" href={it.href} aria-current={sel || undefined} scroll={false}>
                        <span className="zq-vt-when">{it.dateLabel ?? PRECISION_TEXT[pr]}</span>
                        <span className="zq-vt-title">{it.title}</span>
                        {it.evidence ? <EvidenceLabel kind={it.evidence} /> : null}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
            {era.breakAfter ? (
              <div className="zq-vt-break" role="separator">
                <span>{era.breakAfter}</span>
              </div>
            ) : null}
          </li>
        ))}
        {today !== false ? (
          <li className="zq-vt-today">
            <span className="zq-vt-mark zq-vt-now" aria-hidden="true" />
            <span className="zq-vt-title">Today</span>
            <span className="zq-vt-when">{today ?? ""}</span>
          </li>
        ) : null}
      </ol>
    </section>
  );
  return enhance ? <TimelineEnhancer eras={eras.map((e) => ({ title: e.title, id: `era-${slug(e.title)}` }))}>{list}</TimelineEnhancer> : list;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
