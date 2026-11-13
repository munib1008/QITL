import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { Disclosure, TopicCard } from "@/components/science/Parts";
import { scienceTopics } from "@/lib/data/science";
import { getDict } from "@/lib/i18n";
import { scienceStrings } from "@/lib/i18n/modules/science";
import { DISCIPLINES, EVIDENCE_STATES, INTERPRETATION_STRENGTHS, RELATIONSHIPS, type Discipline, type EvidenceState, type InterpretationStrength, type Relationship } from "@/lib/science/model";
import { filterTopics, scienceVerification } from "@/lib/science/status";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = scienceStrings((await params).locale);
  return { title: s.title, description: s.lead };
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const oneOf = <T extends string>(v: string, allowed: readonly T[], extra: string[] = []): T | "" => ((allowed as readonly string[]).includes(v) || extra.includes(v) ? (v as T) : "");

export default async function ScienceHub({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const sp = await searchParams;
  const s = scienceStrings(locale);
  const { connected, items } = await scienceTopics();
  const f = {
    q: one(sp.q).slice(0, 80),
    discipline: oneOf<Discipline>(one(sp.discipline), DISCIPLINES),
    relationship: oneOf<Relationship>(one(sp.relationship), RELATIONSHIPS),
    evidence: oneOf<EvidenceState>(one(sp.evidence), EVIDENCE_STATES, ["unassessed"]) as EvidenceState | "unassessed" | "",
    interpretation: oneOf<InterpretationStrength>(one(sp.interpretation), INTERPRETATION_STRENGTHS, ["unassessed"]) as InterpretationStrength | "unassessed" | "",
  };
  const shown = filterTopics(items, f, locale);
  const verified = items.filter((t) => scienceVerification(t) === "verified").length;
  const filtered = !!(f.q || f.discipline || f.relationship || f.evidence || f.interpretation);
  const sel = (name: string, label: string, value: string, options: Array<[string, string]>) => (
    <div className="sc-field">
      <label htmlFor={`sc-${name}`}>{label}</label>
      <select id={`sc-${name}`} name={name} defaultValue={value}>
        <option value="">{s.filters.all}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <ReadingPage locale={raw} crumbs={[{ label: s.nav }]} kicker={s.kicker} title={s.title} lead={s.lead}>
      <div className="zq-pagebody sc-page" data-testid="science-hub">
        <Disclosure locale={locale} />
        {connected ? null : (
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.notConnected.title}</EvidenceLabel>} title={s.notConnected.title}>
            <p>{s.notConnected.body}</p>
          </EmptyState>
        )}

        <section aria-labelledby="sc-principles-h" className="sc-sections">
          <h2 id="sc-principles-h" className="zq-eyebrow">
            {s.principles.heading}
          </h2>
          <p>{s.principles.intro}</p>
          <ul className="sc-principles" data-testid="science-principles">
            <li>
              <b>{s.assessments.evidenceTitle}</b>
              {s.principles.items.evidence}
            </li>
            <li>
              <b>{s.assessments.interpretationTitle}</b>
              {s.principles.items.interpretation}
            </li>
            <li>
              <b>{s.assessments.connectionTitle}</b>
              {s.principles.items.connection}
            </li>
          </ul>
          <p className="sc-note" data-testid="unseen-note">
            {s.principles.unseen}
          </p>
        </section>

        {connected ? (
          <ul className="sc-stats" data-testid="science-stats">
            <li>
              <b dir="ltr">{items.length}</b>
              <span>{s.stats.topics}</span>
            </li>
            <li>
              <b dir="ltr">{verified}</b>
              <span>{s.stats.verified}</span>
            </li>
            <li>
              <b dir="ltr">{items.length - verified}</b>
              <span>{s.stats.draft}</span>
            </li>
          </ul>
        ) : null}

        <section aria-labelledby="sc-explore-h" className="sc-sections">
          <h2 id="sc-explore-h" className="zq-eyebrow">
            {s.explore.heading}
          </h2>
          <ul className="sc-links" data-testid="science-links">
            <li>
              <Link href="/science/questions">{s.explore.questions}</Link>
            </li>
            <li>
              <Link href="/science/timeline">{s.explore.timeline}</Link>
            </li>
            <li>
              <Link href="/science/journeys">{s.explore.journeys}</Link>
            </li>
            <li>
              <Link href="/verification">{s.explore.verification}</Link>
            </li>
          </ul>
        </section>

        <section aria-labelledby="sc-topics-h" className="sc-sections">
          <h2 id="sc-topics-h" className="zq-eyebrow">
            {connected ? s.stats.topics : s.draftInventory.heading}
          </h2>
          {connected ? null : <p className="sc-note">{s.draftInventory.note}</p>}
          <form method="get" className="sc-filters" role="search" aria-label={s.filters.heading} data-testid="science-filters">
            <div className="sc-field sc-wide">
              <label htmlFor="sc-q">{s.filters.search}</label>
              <input id="sc-q" name="q" type="search" defaultValue={f.q} placeholder={s.filters.searchPlaceholder} autoComplete="off" maxLength={80} />
            </div>
            {sel("discipline", s.filters.discipline, f.discipline, DISCIPLINES.map((d) => [d, s.disciplines[d]]))}
            {sel("relationship", s.filters.relationship, f.relationship, RELATIONSHIPS.map((d) => [d, s.relationships[d]]))}
            {sel("evidence", s.filters.evidence, f.evidence, [["unassessed", s.evidenceStates.unassessed], ...EVIDENCE_STATES.map((d): [string, string] => [d, s.evidenceStates[d]])])}
            {sel("interpretation", s.filters.interpretation, f.interpretation, [["unassessed", s.interpretationStrengths.unassessed], ...INTERPRETATION_STRENGTHS.map((d): [string, string] => [d, s.interpretationStrengths[d]])])}
            <div className="sc-actions sc-wide">
              <button type="submit" className="sc-btn">
                {s.filters.apply}
              </button>
              {filtered ? (
                <Link className="sc-btn" href="/science">
                  {s.filters.reset}
                </Link>
              ) : null}
              <p className="sc-count" role="status" data-testid="science-count">
                {s.filters.results(shown.length)}
              </p>
            </div>
          </form>
          {shown.length ? (
            <ul className="sc-grid" data-testid="topics-grid">
              {shown.map((t) => (
                <TopicCard key={t.slug} t={t} locale={locale} />
              ))}
            </ul>
          ) : connected && !filtered ? (
            <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.emptyTitle}</EvidenceLabel>} title={s.emptyTitle}>
              <p>{s.emptyBody}</p>
            </EmptyState>
          ) : (
            <p data-testid="science-none">{s.filters.none}</p>
          )}
        </section>
      </div>
    </ReadingPage>
  );
}
