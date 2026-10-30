import Link from "next/link";
import type { ReactNode } from "react";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { citation, layersOf, linkTarget, type GuidanceIcon, type GuidanceLesson, type GuidanceLinkRow, type LessonClaim, type SafetyNote } from "@/lib/guidance/topics";
import type { GuidanceStrings } from "@/lib/i18n/modules/guidance";

type L = "en" | "ar" | "ur"; // Urdu shows the English fields until reviewed Urdu content exists

/** Abstract, geometric topic marks (16px grid, 1.5px stroke). Never a figure. */
const ICONS: Record<GuidanceIcon, ReactNode> = {
  wave: <path d="M1 6c2-2 4 2 7 0s5-2 7 0M1 10c2-2 4 2 7 0s5-2 7 0" />,
  bond: (
    <>
      <circle cx={6} cy={8} r={3.5} />
      <circle cx={10} cy={8} r={3.5} />
    </>
  ),
  leaf: <path d="M3 13C3 6 7 3 13 3c0 6-3 10-10 10zM3 13l6-6" />,
  scale: <path d="M8 2v12M4 14h8M2 5h12M2 5l-1.5 4h3zM14 5l-1.5 4h3z" />,
  flame: <path d="M8 1.5c3 3 4.5 5.5 4.5 8a4.5 4.5 0 01-9 0c0-1.5.8-3 2-4 0 1.5.8 2.5 2 2.5 0-2.5-1-4.5.5-6.5z" />,
  return: <path d="M4 5h6a3.5 3.5 0 010 7H5M4 5l2.5-2.5M4 5l2.5 2.5" />,
  moon: <path d="M10.5 2a6 6 0 100 12 5 5 0 010-12z" />,
  lantern: <path d="M6 1.5h4M8 1.5V3M5 3h6l1 2v6l-1 2H5l-1-2V5zM6 14.5h4" />,
  shield: <path d="M8 1.5l5.5 2v4c0 3.5-2.5 6-5.5 7-3-1-5.5-3.5-5.5-7v-4z" />,
  home: <path d="M2 8l6-5.5L14 8M3.5 6.5V14h9V6.5" />,
  hourglass: <path d="M4 1.5h8M4 14.5h8M5 1.5c0 4 6 4.5 6 6.5s-6 2.5-6 6.5M11 1.5c0 4-6 4.5-6 6.5s6 2.5 6 6.5" />,
  star: <path d="M8 1l1.8 4.6L14.5 6l-3.6 3 1.2 4.8L8 11.2 3.9 13.8 5.1 9 1.5 6l4.7-.4z" />,
};

export function TopicIcon({ icon }: { icon: GuidanceIcon }) {
  return (
    <svg className="gd-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round">
      {ICONS[icon]}
    </svg>
  );
}

export function TopicCard({ href, icon, title, alt, altLang, tag }: { href: string; icon: GuidanceIcon; title: string; alt?: string; altLang?: L; tag?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="gd-topic">
        <span className="gd-topic-mark">
          <TopicIcon icon={icon} />
        </span>
        <span className="gd-topic-text">
          <b>{title}</b>
          {alt ? (
            <span lang={altLang} dir={altLang === "ar" ? "rtl" : "ltr"} className="gd-topic-alt">
              {alt}
            </span>
          ) : null}
          {tag}
        </span>
      </Link>
    </li>
  );
}

/** Educational, not a ruling or therapy; written and reviewed by people. Shown on every guidance view. */
export function GuidanceNotice({ s }: { s: GuidanceStrings }) {
  return (
    <aside className="gd-notice" aria-labelledby="gd-notice-h" data-testid="guidance-notice">
      <h2 id="gd-notice-h">{s.notice.title}</h2>
      <p>{s.notice.body}</p>
      <p>{s.notice.noAi}</p>
    </aside>
  );
}

export function MuftiLink({ s }: { s: GuidanceStrings }) {
  return (
    <div className="gd-mufti">
      <Link href="/community/questions" className="zq-btn zq-btn-secondary" data-testid="ask-mufti">
        {s.askMufti}
      </Link>
      <p className="zq-meta">{s.askMuftiNote}</p>
    </div>
  );
}

/** The non-religious recommendation to seek medical / mental-health help, with crisis services. */
export function SafetyNotice({ s, notes = [], locale }: { s: GuidanceStrings; notes?: SafetyNote[]; locale: L }) {
  const care = notes.filter((n) => n.kind !== "ruling_referral");
  return (
    <aside className="gd-safety" role="note" aria-labelledby="gd-safety-h" data-testid="safety-notice">
      <h2 id="gd-safety-h">{s.safety.title}</h2>
      <p>{s.safety.body}</p>
      <p className="gd-crisis">
        <b>{s.safety.crisis}</b>
      </p>
      {care.length ? (
        <>
          <h3>{s.safety.reviewedNotes}</h3>
          <ul>
            {care.map((n) => (
              <li key={n.id}>{(locale === "ar" && n.body_ar) || n.body_en}</li>
            ))}
          </ul>
        </>
      ) : null}
    </aside>
  );
}

function Refs({ c }: { c: LessonClaim }) {
  const refs = c.evidence_claims?.claim_references ?? [];
  if (!refs.length) return null;
  return (
    <span className="gd-refs">
      {refs.map((r, i) => {
        const x = citation(r);
        return (
          <span key={i} className="gd-ref">
            <CitationChip kind={x.kind} href={x.href}>
              {x.label}
            </CitationChip>
            {r.kind === "hadith" && r.hadith_gradings ? (
              <span className="zq-meta">
                {r.hadith_gradings.grade_label} · {r.hadith_gradings.grader}
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

export function LessonView({ lesson, s, locale, index }: { lesson: GuidanceLesson; s: GuidanceStrings; locale: L; index: number }) {
  const { revelation, scholarly } = layersOf(lesson);
  const title = (locale === "ar" && lesson.title_ar) || lesson.title_en;
  const application = (locale === "ar" && lesson.application_ar) || lesson.application_en;
  const h = `gd-lesson-${index}`;
  return (
    <article className="gd-lesson" aria-labelledby={h} data-testid="guidance-lesson">
      <h3 id={h}>{title}</h3>
      <section className="gd-layer gd-layer-revelation" aria-labelledby={`${h}-r`} data-layer="revelation">
        <h4 id={`${h}-r`}>{s.layers.revelation}</h4>
        <p className="zq-meta">{s.layers.revelationNote}</p>
        <ul>
          {revelation.map((c) => (
            <li key={c.id}>
              <EvidenceLabel kind={c.evidence_claims!.evidence} lang={locale} />
              <p lang="en" dir="ltr">{c.evidence_claims!.statement}</p>
              <Refs c={c} />
            </li>
          ))}
        </ul>
      </section>
      <section className="gd-layer gd-layer-scholarly" aria-labelledby={`${h}-s`} data-layer="scholarly">
        <h4 id={`${h}-s`}>{s.layers.scholarly}</h4>
        <p className="zq-meta">{s.layers.scholarlyNote}</p>
        <ul>
          {scholarly.map((c) => (
            <li key={c.id}>
              <EvidenceLabel kind="scholar" lang={locale} />
              <p lang="en" dir="ltr">{c.evidence_claims!.statement}</p>
              <p className="gd-attrib">
                — <b>{c.scholar_name}</b>, {s.scholarIn} <cite>{c.work_title}</cite>
                {c.locator ? `, ${c.locator}` : ""}
              </p>
              <Refs c={c} />
            </li>
          ))}
        </ul>
      </section>
      <section className="gd-layer gd-layer-application" aria-labelledby={`${h}-a`} data-layer="application">
        <h4 id={`${h}-a`}>{s.layers.application}</h4>
        <p className="gd-app-label">{s.layers.applicationLabel}</p>
        <p lang={locale === "ar" && lesson.application_ar ? "ar" : "en"}>{application}</p>
        <p className="zq-meta">{s.layers.applicationNote}</p>
      </section>
      <p className="zq-meta">
        {s.reviewed} · {s.version} {lesson.version}
      </p>
    </article>
  );
}

export function RelatedLinks({ links, s, locale }: { links: GuidanceLinkRow[]; s: GuidanceStrings; locale: L }) {
  const items = links.map((l) => ({ l, t: linkTarget(l, locale) })).filter((x) => x.t);
  if (!items.length) return null;
  return (
    <section aria-labelledby="gd-related-h" className="gd-related">
      <h2 id="gd-related-h">{s.relatedHeading}</h2>
      <ul>
        {items.map(({ l, t }) => (
          <li key={l.id}>
            <span className="zq-eyebrow">{s.relatedKinds[l.target_kind]}</span>
            {t!.href ? <Link href={t!.href}>{t!.label}</Link> : <b>{t!.label}</b>}
            {(locale === "ar" && l.note_ar) || l.note_en ? <p className="zq-meta">{(locale === "ar" && l.note_ar) || l.note_en}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
