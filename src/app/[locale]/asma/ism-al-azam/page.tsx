import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { Section, Unavailable } from "@/components/asma/Parts";
import { getDict } from "@/lib/i18n";
import { asmaStrings } from "@/lib/i18n/modules/asma";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = asmaStrings((await params).locale);
  return { title: s.ism.title, description: s.ism.lead };
}

/** A research page made of placeholders only: it names no Name, ranks nothing and invents no content. */
export default async function IsmAlAzam({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const s = asmaStrings(locale);
  const i = s.ism;
  const kinds = { question: "unknown", narrations: "hadith", positions: "scholar", limits: "unknown" } as const;
  return (
    <ReadingPage locale={raw} crumbs={[{ href: "/asma", label: s.nav }, { label: i.title }]} kicker={s.kicker} title={i.title} lead={i.lead}>
      <div className="zq-pagebody as-page">
        <div className="as-sections">
          {(Object.keys(i.sections) as Array<keyof typeof i.sections>).map((k) => (
            <Section key={k} id={`as-ism-${k}`} title={i.sections[k].title}>
              <EvidenceLabel kind={kinds[k]} lang={locale} />
              <p>{i.sections[k].body}</p>
              {k !== "limits" ? <Unavailable locale={locale}>{i.unavailable}</Unavailable> : null}
            </Section>
          ))}
        </div>
      </div>
    </ReadingPage>
  );
}
