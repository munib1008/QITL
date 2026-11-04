import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { Disclosure, Unavailable } from "@/components/science/Parts";
import { getDict } from "@/lib/i18n";
import { scienceStrings } from "@/lib/i18n/modules/science";
import { AUDIENCES, JOURNEYS } from "@/lib/science/journeys";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = scienceStrings((await params).locale).journeys;
  return { title: s.title, description: s.lead };
}

export default async function JourneysPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const s = scienceStrings(locale);
  const j = s.journeys;
  return (
    <ReadingPage locale={raw} crumbs={[{ href: "/science", label: s.nav }, { label: j.title }]} kicker={s.kicker} title={j.title} lead={j.lead}>
      <div className="zq-pagebody sc-page" data-testid="science-journeys">
        <Disclosure locale={locale} />
        <ul className="sc-journeys">
          {AUDIENCES.map((a) => (
            <li key={a} className="sc-journey" data-audience={a} data-testid="journey">
              <h2>{j.audiences[a]}</h2>
              <ol>
                {JOURNEYS[a].map((step) => (
                  <li key={step.key} data-written={step.written ? "true" : "false"}>
                    {step.href ? <Link href={step.href}>{j.steps[step.key]}</Link> : j.steps[step.key]}
                    {step.written ? null : <span className="sc-note"> · {j.pending}</span>}
                  </li>
                ))}
              </ol>
              <Unavailable locale={locale}>{j.pending}</Unavailable>
            </li>
          ))}
        </ul>
      </div>
    </ReadingPage>
  );
}
