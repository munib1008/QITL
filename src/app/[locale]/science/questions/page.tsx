import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { Disclosure, En, Unavailable } from "@/components/science/Parts";
import { scienceQuestions } from "@/lib/data/science";
import { getDict } from "@/lib/i18n";
import { scienceStrings } from "@/lib/i18n/modules/science";
import { pick3 } from "@/lib/science/model";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = scienceStrings((await params).locale).questions;
  return { title: s.title, description: s.lead };
}

export default async function QuestionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const s = scienceStrings(locale);
  const q = s.questions;
  const { connected, items } = await scienceQuestions();
  const field = (label: string, v: string | null) => (
    <div>
      <dt>{label}</dt>
      <dd>{v ? <En locale={locale}>{v}</En> : <Unavailable locale={locale}>{q.placeholder}</Unavailable>}</dd>
    </div>
  );
  return (
    <ReadingPage locale={raw} crumbs={[{ href: "/science", label: s.nav }, { label: q.title }]} kicker={s.kicker} title={q.title} lead={q.lead}>
      <div className="zq-pagebody sc-page" data-testid="science-questions">
        <Disclosure locale={locale} />
        {connected ? null : (
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.notConnected.title}</EvidenceLabel>} title={s.notConnected.title}>
            <p>{s.notConnected.body}</p>
          </EmptyState>
        )}
        {items.length ? (
          <ul className="sc-list" data-testid="questions-list">
            {items.map((x, i) => (
              <li key={i} data-testid="open-question">
                <h2 style={{ margin: 0, font: "600 18px/26px var(--font-display)" }}>
                  <En locale={locale}>{x.question}</En>
                </h2>
                <p className="sc-meta">
                  <span>
                    {q.topic}: <Link href={`/science/${x.topic}`}>{pick3(x.topic_title, locale)}</Link>
                  </span>
                  <span>{s.testability[x.testability]}</span>
                </p>
                {x.topic_kind === "unseen" ? <p className="sc-note">{q.unseenNote}</p> : null}
                <dl className="sc-sections">
                  {field(q.known, x.known)}
                  {field(q.uncertain, x.uncertain)}
                  {field(q.competing, x.competing)}
                  {field(q.why, x.why_connection)}
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{q.none}</EvidenceLabel>} title={q.none}>
            <p>{q.noneBody}</p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
