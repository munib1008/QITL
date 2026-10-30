import Link from "next/link";
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
export function VerticalTimeline({ eras, today, selected, label = "Timeline from Adam to today" }: { eras: TimelineEra[]; today?: string | false; selected?: string; label?: string }) {
  return (
    <section className="zq-vt" aria-label={label}>
      <p className="zq-vt-scale">Ordered from Adam to today · not to scale</p>
      <ol className="zq-vt-list">
        {eras.map((era) => (
          <li key={era.title} className={cx("zq-vt-era", `zq-vt-era-${era.kind}`)} data-era-kind={era.kind}>
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
                  <li key={it.id} className={cx("zq-vt-item", sel && "zq-vt-sel")} data-precision={pr}>
                    <span className={`zq-vt-mark ${MARK[pr]}`} aria-hidden="true" />
                    <Link className="zq-vt-btn" href={it.href} aria-current={sel || undefined} scroll={false}>
                      <span className="zq-vt-when">{it.dateLabel ?? PRECISION_TEXT[pr]}</span>
                      <span className="zq-vt-title">{it.title}</span>
                      {it.evidence ? <EvidenceLabel kind={it.evidence} /> : null}
                    </Link>
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
}
