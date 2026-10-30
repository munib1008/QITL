import type { ReactNode } from "react";
import Link from "next/link";
import { cx } from "@/lib/cx";
import type { EvidenceKind } from "@/content/journey";
import { CitationChip, DemoTag, EditorialStatus, EvidenceLabel, HadithGrade, type HadithGradeProps } from "./evidence";
import { Icon, Star } from "./icons";
import { CardActions, type CardActionsProps } from "./CardActions";

export interface VerseCardProps {
  surahName: string;
  reference: string;
  /** Arabic from the verified canonical source only. Null renders the "pending verified source" state. */
  arabic: string | null;
  translation?: string;
  translator?: string;
  edition?: string;
  licence?: "cleared" | "pending";
  demo?: boolean;
  actions?: Omit<CardActionsProps, "reference"> | false;
}

/** A single ayah: Arabic first, translation second (only when licensed), translator and edition always shown. */
export function VerseCard({ surahName, reference, arabic, translation, translator, edition, licence, demo, actions }: VerseCardProps) {
  const showTranslation = licence === "cleared" && translation;
  return (
    <article className="zq-card" aria-label={`Quran ${reference}`}>
      <div className="zq-card-head">
        <p className="zq-eyebrow">{surahName}</p>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {demo ? <DemoTag /> : null}
          <EvidenceLabel kind="quran" />
          <CitationChip>{reference}</CitationChip>
        </span>
      </div>
      {arabic ? (
        <p className="zq-ar-quran" lang="ar" dir="rtl">
          {arabic}
        </p>
      ) : (
        <p className="zq-licence zq-licence-pending" data-testid="arabic-pending">
          Arabic text not loaded — waiting for the verified Quran source to be imported.
        </p>
      )}
      {showTranslation ? <p className="zq-trans">{translation}</p> : null}
      <p className={cx("zq-licence", licence !== "cleared" && "zq-licence-pending")}>
        {licence !== "cleared"
          ? "Translation unavailable — licence pending"
          : translator
            ? `Translation: ${translator}${edition ? ` · ${edition}` : ""}`
            : "Arabic only"}
      </p>
      {actions === false ? null : <CardActions reference={reference} {...(actions ?? {})} />}
    </article>
  );
}

export interface HadithCardProps {
  collection: string;
  number: string;
  numbering?: string;
  arabic?: string;
  translation?: string;
  gradings?: HadithGradeProps[];
  demo?: boolean;
  actions?: Omit<CardActionsProps, "reference"> | false;
}

/** One narration. Every recorded grading is listed; none recorded is an honest state. */
export function HadithCard({ collection, number, numbering, arabic, translation, gradings, demo, actions }: HadithCardProps) {
  return (
    <article className="zq-card" aria-label={`${collection} ${number}`}>
      <div className="zq-card-head">
        <p className="zq-eyebrow">{collection}</p>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {demo ? <DemoTag /> : null}
          <CitationChip>{number}</CitationChip>
        </span>
      </div>
      {numbering ? <p className="zq-meta">Numbering: {numbering}</p> : null}
      {arabic ? (
        <p className="zq-ar-naskh" lang="ar" dir="rtl">
          {arabic}
        </p>
      ) : null}
      {translation ? <p className="zq-trans">{translation}</p> : null}
      <ul className="zq-gradings" aria-label="Gradings">
        {(gradings?.length ? gradings : [{}]).map((g, i) => (
          <li key={i}>
            <HadithGrade {...g} />
          </li>
        ))}
      </ul>
      {actions === false ? null : <CardActions reference={`${collection} ${number}`} {...(actions ?? {})} />}
    </article>
  );
}

export type DatePrecision = "exact" | "range" | "estimated" | "relative" | "unknown";
export const PRECISION_TEXT: Record<DatePrecision, string> = {
  exact: "Exact date",
  range: "Date range",
  estimated: "Estimated",
  relative: "Relative order only",
  unknown: "Date unknown",
};

function DateTrack({ precision, start, end }: { precision: DatePrecision; start?: number; end?: number }) {
  const s = start ?? 30;
  const e = end ?? s + 30;
  const mark =
    precision === "exact" ? (
      <span className="zq-track-exact" style={{ insetInlineStart: `calc(${s}% - 6px)` }} />
    ) : precision === "range" ? (
      <span className="zq-track-range" style={{ insetInlineStart: `${s}%`, width: `${e - s}%` }} />
    ) : precision === "estimated" ? (
      <span className="zq-track-est" style={{ insetInlineStart: `${s}%`, width: `${e - s}%` }} />
    ) : precision === "relative" ? (
      <span className="zq-track-rel" style={{ insetInlineStart: `calc(${s}% - 6px)` }} />
    ) : (
      <span className="zq-track-unknown" />
    );
  return (
    <div className="zq-track" role="img" aria-label={PRECISION_TEXT[precision]}>
      <span className="zq-track-line" />
      {mark}
    </div>
  );
}

export interface EventCardProps {
  title: string;
  category?: string;
  summary?: string;
  precision: DatePrecision;
  dateLabel?: string;
  start?: number;
  end?: number;
  place?: string;
  evidence?: EvidenceKind;
  references?: string[];
}

export function EventCard({ title, category, summary, precision, dateLabel, start, end, place, evidence, references }: EventCardProps) {
  return (
    <article className="zq-card" style={{ maxWidth: 420 }}>
      <div className="zq-card-head">
        <p className="zq-eyebrow">{category ?? "Event"}</p>
        {evidence ? <EvidenceLabel kind={evidence} /> : null}
      </div>
      <h3 className="zq-title">{title}</h3>
      {summary ? <p className="zq-meta">{summary}</p> : null}
      <div>
        <span className="zq-datelabel">
          {PRECISION_TEXT[precision]}
          {dateLabel ? ` · ${dateLabel}` : ""}
        </span>
        <DateTrack precision={precision} start={start} end={end} />
      </div>
      <p className="zq-meta">
        Location: <b style={{ color: "var(--ink)" }}>{place ?? "Unknown location"}</b>
      </p>
      {references?.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {references.map((r) => (
            <CitationChip key={r}>{r}</CitationChip>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export interface ProphetCardProps {
  name: string;
  arabicName?: string;
  honorific?: string;
  order?: string;
  mentions?: ReactNode;
  href: string;
}

export function ProphetCard({ name, arabicName, honorific, order, mentions, href }: ProphetCardProps) {
  return (
    <Link className="zq-card zq-prophet zq-focus" href={href} style={{ textDecoration: "none", maxWidth: "none" }}>
      <Star className="zq-prophet-mark" />
      <div>
        <p className="zq-prophet-name">
          {name}{" "}
          <span className="zq-meta" style={{ display: "inline" }} lang="ar">
            {honorific ?? "(عليه السلام)"}
          </span>
        </p>
        {arabicName ? (
          <div className="zq-prophet-ar" lang="ar" dir="rtl">
            {arabicName}
          </div>
        ) : null}
        <div className="zq-order">{order ? `Relative order: ${order}` : "Order: unknown"}</div>
      </div>
      {mentions != null ? (
        <p className="zq-meta" style={{ gridColumn: "1 / -1" }}>
          {mentions}
        </p>
      ) : null}
    </Link>
  );
}

export interface CommentProps {
  author: string;
  role?: string;
  time: string;
  body?: string;
  citation?: string;
  edited?: boolean;
  status?: "visible" | "hidden" | "removed";
  demo?: boolean;
  /** Present only when the viewer may act; otherwise the actions render disabled with the reason. */
  actions?: ReactNode;
}

/** A discussion unit. Hidden or removed comments keep their place with a neutral explanation. */
export function Comment({ author, role, time, body, citation, edited, status = "visible", demo, actions }: CommentProps) {
  const initials = author
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return (
    <article className="zq-comment">
      <span className="zq-avatar" aria-hidden="true">
        {initials}
      </span>
      <div>
        <div className="zq-comment-head">
          <span className="zq-comment-author">{author}</span>
          {demo ? <DemoTag /> : null}
          {role ? <EditorialStatus status="approved">{role}</EditorialStatus> : null}
          <span className="zq-meta">{time}</span>
          {edited ? <span className="zq-meta">· edited</span> : null}
        </div>
        {status === "visible" ? (
          <p className="zq-comment-body">{body}</p>
        ) : (
          <p className="zq-comment-removed">
            {status === "hidden"
              ? "Hidden while a moderator reviews a report."
              : "Removed by a moderator for breaking the discussion guidelines."}
          </p>
        )}
        {status === "visible" && citation ? (
          <div style={{ marginBottom: 8 }}>
            <CitationChip kind="Cites">{citation}</CitationChip>
          </div>
        ) : null}
        {status === "visible" && actions ? <div style={{ display: "flex", gap: 4 }}>{actions}</div> : null}
      </div>
    </article>
  );
}

export function IconButton({
  icon,
  children,
  ...rest
}: { icon: keyof typeof Icon; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const I = Icon[icon];
  return (
    <button type="button" className="zq-iconbtn" {...rest}>
      <I />
      {children}
    </button>
  );
}
