import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { Section, Unavailable } from "@/components/asma/Parts";
import { getDict } from "@/lib/i18n";
import { asmaStrings } from "@/lib/i18n/modules/asma";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = asmaStrings((await params).locale);
  return { title: s.response.title, description: s.response.lead };
}

/** A learning centre in outline: headings only, each saying that its source is still needed. No text is invented. */
export default async function Response({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const s = asmaStrings(locale);
  const r = s.response;
  return (
    <ReadingPage locale={raw} crumbs={[{ href: "/asma", label: s.nav }, { label: r.title }]} kicker={s.kicker} title={r.title} lead={r.lead}>
      <div className="zq-pagebody as-page">
        <div className="as-sections" data-testid="response-points">
          {r.points.map((p, i) => (
            <Section key={p} id={`as-resp-${i}`} letter={String(i + 1)} title={p}>
              <Unavailable locale={locale}>{r.needsSource}</Unavailable>
            </Section>
          ))}
        </div>
      </div>
    </ReadingPage>
  );
}
