import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/science.css";
import { VerificationBadge } from "@/components/verification/VerificationBadge";
import { englishContent } from "@/lib/i18n";
import { scienceStrings } from "@/lib/i18n/modules/science";
import { pick3, type Assessed, type L3, type TopicListItem } from "@/lib/science/model";
import { firstVerifiedMilestone, refLabel, scienceVerification } from "@/lib/science/status";

/** The visible, never-collapsed disclosure that every Quran & Science page carries while content is a draft. */
export function Disclosure({ locale }: { locale: string }) {
  const s = scienceStrings(locale).disclosure;
  return (
    <aside className="sc-draft" role="note" aria-label={s.badge} data-testid="science-disclosure">
      <b>{s.badge}</b>
      <p>{s.body}</p>
    </aside>
  );
}

/** What an unfilled section says: that it is awaiting an author and a reviewer. Never filler. */
export function Unavailable({ locale, children }: { locale: string; children?: ReactNode }) {
  const t = scienceStrings(locale).topic;
  return (
    <div className="sc-unavailable" data-testid="unavailable">
      <b>{t.unavailable}</b>
      <span>{children ?? t.awaiting}</span>
    </div>
  );
}

export function Section({ id, n, title, children }: { id: string; n?: number; title: string; children: ReactNode }) {
  return (
    <section className="sc-section" aria-labelledby={`${id}-h`} id={id}>
      <h2 id={`${id}-h`}>
        {n ? (
          <span className="sc-num" aria-hidden="true">
            {n}
          </span>
        ) : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The distinct values of an assessment across a topic's rows; "unassessed" when nothing has been rated. */
function distinct<T extends string>(vals: Array<Assessed<T>>): Array<Assessed<T>> {
  const set = [...new Set(vals.filter((v) => v !== "unassessed"))];
  return set.length ? set : ["unassessed"];
}

type Kind = "evidence" | "interpretation" | "connection" | "relationship";

/**
 * One assessment, labelled in words and with a border style (never colour alone). "Not yet assessed" is dashed and says that it is
 * not a negative rating. The assessments are rendered side by side and never summed.
 */
export function Assessment({ kind, values, locale }: { kind: Kind; values: string[]; locale: string }) {
  const s = scienceStrings(locale);
  const title = { evidence: s.assessments.evidenceTitle, interpretation: s.assessments.interpretationTitle, connection: s.assessments.connectionTitle, relationship: s.assessments.relationshipTitle }[kind];
  const dict: Record<string, string> = { evidence: s.evidenceStates, interpretation: s.interpretationStrengths, connection: s.connectionStrengths, relationship: s.relationships }[kind];
  return (
    <div className="sc-assess" data-kind={kind} data-testid={`assess-${kind}`}>
      <dt>{title}</dt>
      <dd>
        <ul>
          {values.map((v) => (
            <li key={v} data-value={v} data-unassessed={v === "unassessed" ? "true" : undefined}>
              {dict[v] ?? v}
            </li>
          ))}
        </ul>
        {kind === "connection" ? <small>{s.assessments.reviewerSet}</small> : null}
      </dd>
    </div>
  );
}

export function Assessments({ item, locale }: { item: Pick<TopicListItem, "links" | "evidence_states">; locale: string }) {
  return (
    <dl className="sc-assessments">
      <Assessment kind="evidence" values={distinct(item.evidence_states)} locale={locale} />
      <Assessment kind="interpretation" values={distinct(item.links.map((l) => l.interpretation_strength))} locale={locale} />
      <Assessment kind="connection" values={distinct(item.links.map((l) => l.connection_strength))} locale={locale} />
      <Assessment kind="relationship" values={distinct(item.links.map((l) => l.relationship))} locale={locale} />
    </dl>
  );
}

/** Two separate review lines and the shared verification badges (one per pathway). A pathway's badge never shows Verified on its own. */
export function ReviewBadges({ t, locale, detail }: { t: Pick<TopicListItem, "published" | "scholarly_status" | "scientific_review" | "ai_generated" | "needs_rereview">; locale: string; detail?: boolean }) {
  const s = scienceStrings(locale);
  const state = scienceVerification(t);
  return (
    <div className="sc-reviews" data-testid="science-reviews">
      <dl className="sc-review-lines">
        <div data-testid="review-scientific">
          <dt>{s.card.scientificReview}</dt>
          <dd>{s.reviewStatuses[t.scientific_review]}</dd>
        </div>
        <div data-testid="review-scholarly">
          <dt>{s.card.scholarlyReview}</dt>
          <dd>{s.reviewStatuses[t.scholarly_status]}</dd>
        </div>
      </dl>
      {detail ? (
        <>
          <VerificationBadge state={state} locale={locale} kind="scientific" detail={{ reviewerRole: s.card.scientificReview }} />
          <VerificationBadge state={state} locale={locale} kind="scholarly" notice={false} detail={{ reviewerRole: s.card.scholarlyReview }} />
        </>
      ) : (
        <VerificationBadge state={state} locale={locale} kind="scientific" notice={false} />
      )}
    </div>
  );
}

export function TopicCard({ t, locale }: { t: TopicListItem; locale: string }) {
  const s = scienceStrings(locale);
  const m = firstVerifiedMilestone(t.milestones);
  return (
    <li className="sc-card" data-testid="topic-card" data-slug={t.slug} data-origin={t.origin ?? "database"}>
      <h3>
        <Link href={`/science/${t.slug}`}>{pick3(t.title, locale)}</Link>
      </h3>
      <p className="sc-meta">
        <span>
          {s.card.quran} <bdi dir="ltr">{refLabel(t.links)}</bdi>
        </span>
        <span>{s.disciplines[t.discipline]}</span>
        {t.origin === "draft_file" ? <span>{s.card.draftSource}</span> : null}
      </p>
      <Assessments item={t} locale={locale} />
      <p className="sc-milestone" data-testid="card-milestone">
        {m ? (
          <>
            {s.card.firstMilestone}: <bdi dir="ltr">{m.year}</bdi>
          </>
        ) : (
          s.card.noMilestone
        )}
      </p>
      <ReviewBadges t={t} locale={locale} />
      <Link className="sc-open" href={`/science/${t.slug}`}>
        {s.card.open}
        <span className="sc-sr"> · {pick3(t.title, locale)}</span>
      </Link>
    </li>
  );
}

/** English-only text inside an Arabic or Urdu page keeps its own language and direction. */
export function En({ locale, children, as: Tag = "span" }: { locale: string; children: ReactNode; as?: "span" | "p" | "div" }) {
  return <Tag {...englishContent(locale)}>{children}</Tag>;
}

export type { L3 };
