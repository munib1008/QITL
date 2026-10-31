import Link from "next/link";
import type { ReactNode } from "react";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { HadithCard } from "@/components/ui/cards";
import { AUTHENTIC_GRADES } from "@/lib/data/hadith";
import { referenceOf } from "@/lib/encyclopedia/mapping";
import {
  allVerses,
  identificationStatus,
  nameLines,
  pick,
  relationKey,
  verseHref,
  verseLabel,
  type CommunityListItem,
  type EvidenceBlock,
  type FamilyEdge,
  type Localized,
  type NarrationView,
  type PersonListItem,
  type RelatedEvent,
  type StoryListItem,
  type SubjectItem,
} from "@/lib/encyclopedia/model";
import { fill } from "@/lib/i18n/modules/search";
import { timelineStrings } from "@/lib/i18n/modules/timeline";
import type { EncyclopediaStrings } from "@/lib/i18n/modules/encyclopedia";
import type { HadithStoryStrings } from "@/lib/i18n/modules/hadithStories";
import "@/styles/encyclopedia.css";

const dirOf = (l: string) => (l === "en" ? "ltr" : "rtl");

/** Text in the page's language, or the English text marked as English (never machine-translated). */
export function Local({ value, locale, as: Tag = "span" }: { value: Localized; locale: string; as?: "span" | "p" | "div" }) {
  const p = pick(value, locale);
  if (!p.text) return null;
  return (
    <Tag lang={p.lang} dir={dirOf(p.lang)}>
      {p.text}
    </Tag>
  );
}

/** A name with its Arabic form beside it, each marked with its own language. */
export function Name({ en, ar, locale }: { en: string; ar: string | null; locale: string }) {
  const n = nameLines(en, ar, locale);
  return (
    <>
      <span lang={n.mainLang} dir={dirOf(n.mainLang)}>
        {n.main}
      </span>
      {n.alt ? (
        <small className="he-alt" lang={n.altLang} dir={dirOf(n.altLang)}>
          {n.alt}
        </small>
      ) : null}
    </>
  );
}

export function CountsNote({ counts, labels }: { counts: { published: number; under_review: number } | null; labels: { underReview: string; published: string } }) {
  if (!counts) return null;
  return (
    <p className="zq-meta he-counts" data-testid="encyclopedia-counts">
      {fill(labels.underReview, { n: counts.under_review })} · {fill(labels.published, { n: counts.published })}
    </p>
  );
}

// ---------- Hadith stories ----------
export function StoryCard({ s, locale, t }: { s: StoryListItem; locale: string; t: HadithStoryStrings }) {
  const narrator = pick(s.narrator, locale);
  return (
    <li className="he-card" data-testid="story-card" data-kind={s.kind}>
      <p className="zq-eyebrow he-kind">{t.kinds[s.kind]}</p>
      <h3 className="he-card-title">
        <Link href={`/hadith-stories/${s.slug}`}>
          <Local value={s.title} locale={locale} />
        </Link>
      </h3>
      {narrator.text ? (
        <p className="zq-meta">
          {t.card.narrator}:{" "}
          <span lang={narrator.lang} dir={dirOf(narrator.lang)}>
            {narrator.text}
          </span>
        </p>
      ) : null}
      <Local value={s.summary} locale={locale} as="p" />
      {s.primary ? (
        <p className="zq-meta he-ref">
          {s.primary.collection} {s.primary.number}
        </p>
      ) : null}
      <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href={`/hadith-stories/${s.slug}`}>
        {t.card.read}
      </Link>
    </li>
  );
}

export function NarrationCard({ n, t }: { n: NarrationView; t: HadithStoryStrings }) {
  const varies = new Set(n.gradings.map((g) => g.grade)).size > 1;
  const ref = referenceOf(n);
  return (
    <div className="he-narration" data-testid="narration" data-primary={n.primary}>
      <p className="zq-eyebrow">{n.primary ? t.detail.primary : t.detail.variants}</p>
      <HadithCard
        collection={ref.replace(/ \d+[a-z]?$/, "")}
        number={ref}
        numbering={n.numbering || undefined}
        arabic={n.arabic ?? undefined}
        translation={n.translation?.text}
        gradings={n.gradings.map((g) => ({ grade: g.grade_label, grader: g.grader, source: g.citation ?? undefined, authentic: AUTHENTIC_GRADES.has(g.grade), varies }))}
        actions={false}
      />
      {n.variantNote ? <p className="zq-meta">{n.variantNote}</p> : null}
      {n.translation ? <p className="zq-licence">{n.translation.translator}</p> : null}
      {n.attribution ? <p className="zq-licence">{n.attribution}</p> : null}
      {!n.textAllowed ? <p className="zq-licence zq-licence-pending">{t.detail.referenceOnly}</p> : null}
      {n.relied ? <p className="zq-meta">{fill(t.detail.gradedBy, { grade: n.relied.grade_label, grader: n.relied.grader })}</p> : n.gradings.length ? null : <p className="zq-meta">{t.detail.gradingNone}</p>}
      <Link className="zq-btn zq-btn-quiet zq-btn-sm zq-btn-link" href={`/hadith/${n.collection}/${n.number}`}>
        {t.detail.openNarration}
      </Link>
    </div>
  );
}

/** "Hadith stories" block on person and community pages. */
export function StoryLinks({ stories, locale, t, title, empty }: { stories: StoryListItem[]; locale: string; t: HadithStoryStrings; title: string; empty: string }) {
  return (
    <section className="he-sec" aria-labelledby="he-hs-h" data-testid="linked-stories">
      <h2 id="he-hs-h">{title}</h2>
      {stories.length ? (
        <ul className="he-list">
          {stories.map((s) => (
            <li key={s.slug}>
              <Link href={`/hadith-stories/${s.slug}`}>
                <Local value={s.title} locale={locale} />
              </Link>
              <span className="zq-meta"> · {t.kinds[s.kind]}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="zq-meta">{empty}</p>
      )}
    </section>
  );
}

// ---------- People and communities ----------
export function IdentificationBlock({ subject, t, locale }: { subject: SubjectItem | null; t: EncyclopediaStrings; locale: string }) {
  const status = identificationStatus(subject);
  const tl = timelineStrings(locale);
  const standing = (k: string) => (tl.event.standing as Record<string, string>)[k] ?? (t.standing as Record<string, string>)[k] ?? k;
  const kindLabel = (k: string) => (t.identification.kinds as Record<string, string>)[k] ?? k;
  const groups = new Map<string, { kind: string; subject: string; views: Array<{ view: string; standing: string }> }>();
  for (const i of subject?.identifications ?? []) {
    const key = `${i.kind}|${i.subject}`;
    const g = groups.get(key) ?? { kind: i.kind, subject: i.subject, views: [] };
    g.views.push({ view: i.view, standing: i.standing });
    groups.set(key, g);
  }
  return (
    <section className="he-sec" aria-labelledby="he-id-h" data-testid="identification" data-status={status}>
      <h2 id="he-id-h">{t.identification.heading}</h2>
      <p className="he-status" data-status={status}>
        <span aria-hidden="true">{status === "named" ? "●" : status === "later" ? "◇" : "○"}</span>{" "}
        {status === "named" ? t.identification.named : status === "later" ? t.identification.later : t.identification.unknown}
      </p>
      {status !== "named" ? <p className="zq-meta">{status === "later" ? t.identification.laterNote : t.identification.unknownNote}</p> : null}
      {groups.size ? (
        <div>
          <h3>{t.identification.views}</h3>
          {[...groups.values()].map((g) => (
            <div key={`${g.kind}|${g.subject}`} className="he-ident">
              <b>
                {kindLabel(g.kind)}
                {g.subject ? `: ${g.subject}` : ""}
              </b>
              <ul>
                {g.views.map((v) => (
                  <li key={v.view}>
                    <span className="he-standing">{standing(v.standing)}</span> {v.view}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
      {subject ? (
        <Link className="zq-btn zq-btn-quiet zq-btn-sm zq-btn-link" href={`/events/${subject.slug}`}>
          {t.identification.openItem}
        </Link>
      ) : null}
    </section>
  );
}

export function QuranSection({ evidence, subject, t, lang }: { evidence: EvidenceBlock[]; subject: SubjectItem | null; t: EncyclopediaStrings; lang: string }) {
  const verses = allVerses(evidence, subject);
  return (
    <section className="he-sec" aria-labelledby="he-q-h" data-testid="quran-refs">
      <h2 id="he-q-h">{t.sections.quran}</h2>
      {verses.length ? (
        <>
          <p className="zq-meta">{t.sections.quranNote}</p>
          <div className="he-verses" role="group" aria-label={t.sections.quran}>
            {verses.map((v) => (
              <CitationChip key={verseLabel(v)} href={verseHref(v)}>
                {`Q ${verseLabel(v)}`}
              </CitationChip>
            ))}
          </div>
          <ul className="he-list">
            {evidence
              .filter((e) => e.statement)
              .map((e) => (
                <li key={e.claimId}>
                  {e.evidence ? <EvidenceLabel kind={e.evidence as never} lang={lang} /> : null}{" "}
                  <span lang="en" dir="ltr">
                    {e.statement}
                  </span>
                </li>
              ))}
          </ul>
        </>
      ) : (
        <p className="zq-meta">{t.sections.noQuran}</p>
      )}
    </section>
  );
}

export function FamilySection({ edges, t, locale }: { edges: FamilyEdge[]; t: EncyclopediaStrings; locale: string }) {
  const labels = t.relations as Record<string, string>;
  return (
    <section className="he-sec" aria-labelledby="he-fam-h" data-testid="family">
      <h2 id="he-fam-h">{t.sections.family}</h2>
      {edges.length ? (
        <>
          <p className="zq-meta">{t.sections.familyNote}</p>
          <ul className="he-list">
            {edges.map((e) => (
              <li key={`${e.kind}-${e.direction}-${e.other.slug}`}>
                {labels[relationKey(e)] ?? e.kind}:{" "}
                <Link href={`/people/${e.other.slug}`}>
                  <Name en={e.other.name_en} ar={e.other.name_ar} locale={locale} />
                </Link>{" "}
                {e.competing ? <span className="he-standing">{t.sections.disputed}</span> : null}
                {e.statement ? (
                  <span className="zq-meta" lang="en" dir="ltr">
                    {" "}
                    · {e.statement}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {edges.some((e) => e.competing) ? <p className="zq-meta">{t.sections.competing}</p> : null}
        </>
      ) : (
        <p className="zq-meta">{t.sections.noFamily}</p>
      )}
    </section>
  );
}

export function EventsSection({ events, t, locale }: { events: RelatedEvent[]; t: EncyclopediaStrings; locale: string }) {
  return (
    <section className="he-sec" aria-labelledby="he-ev-h" data-testid="related-events">
      <h2 id="he-ev-h">{t.sections.events}</h2>
      {events.length ? (
        <ul className="he-list">
          {events.map((e) => (
            <li key={e.slug}>
              <Link href={`/events/${e.slug}`}>
                <Name en={e.title} ar={e.title_ar} locale={locale} />
              </Link>
              {e.role ? <span className="zq-meta"> · {e.role}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="zq-meta">{t.sections.noEvents}</p>
      )}
    </section>
  );
}

export function NotEstablished({ items, t }: { items: Array<{ label: string; value: string | null }>; t: EncyclopediaStrings }) {
  return (
    <section className="he-sec" aria-labelledby="he-ne-h" data-testid="not-established">
      <h2 id="he-ne-h">{t.sections.uncertain}</h2>
      <p className="zq-meta">{t.sections.uncertainNote}</p>
      <dl className="he-facts">
        {items.map((i) => (
          <div key={i.label}>
            <dt>{i.label}</dt>
            <dd data-established={i.value ? "yes" : "no"}>
              {i.value ?? (
                <>
                  <b>{t.sections.notEstablished}</b>
                  <span className="zq-meta"> · {t.sections.notEstablishedLine}</span>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function IdentChip({ source, t }: { source: "quran" | "later_tradition" | null; t: EncyclopediaStrings }) {
  if (source === "later_tradition")
    return (
      <p className="he-status" data-status="later">
        <span aria-hidden="true">◇</span> {t.identification.later}
      </p>
    );
  if (source === "quran")
    return (
      <p className="he-status" data-status="named">
        <span aria-hidden="true">●</span> {t.identification.named}
      </p>
    );
  return null;
}

export function PersonCard({ p, locale, t }: { p: PersonListItem; locale: string; t: EncyclopediaStrings }) {
  return (
    <li className="he-card" data-testid="person-card" data-group={p.group}>
      <h3 className="he-card-title">
        <Link href={`/people/${p.slug}`}>
          <Name en={p.name_en} ar={p.name_ar} locale={locale} />
        </Link>
      </h3>
      <IdentChip source={p.name_source} t={t} />
    </li>
  );
}

export function CommunityCard({ c, locale, t }: { c: CommunityListItem; locale: string; t: EncyclopediaStrings }) {
  return (
    <li className="he-card" data-testid="community-card">
      <h3 className="he-card-title">
        <Link href={`/communities/${c.slug}`}>
          <Name en={c.name_en} ar={c.name_ar} locale={locale} />
        </Link>
      </h3>
      <IdentChip source={c.name_source} t={t} />
    </li>
  );
}

export function Aside({ children }: { children: ReactNode }) {
  return <div className="he-aside">{children}</div>;
}
