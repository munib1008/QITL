import type { Metadata } from "next";
import { BASE, LtaShell, NoRecords, okData } from "@/components/lifestyle/Shell";
import { RecordMeta, ReconstructionContainer } from "@/components/lifestyle/Evidence";
import { Scene } from "@/components/lifestyle/Scene";
import { Markdown } from "@/components/ui/Markdown";
import { lifestyleStrings } from "@/lib/i18n/modules/lifestyle";
import { getReconstructions } from "@/lib/lifestyle/data";
import { DAY_PARTS, segmentOk, type DayPart } from "@/lib/lifestyle/model";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const l = (await params).locale;
  const t = lifestyleStrings(l);
  return { title: `${t.sections.day} · ${t.title}`, alternates: { canonical: `${BASE}/day` } };
}
export const revalidate = 300;

/** "A Day in This Era": class D reconstructions only, always in the reconstruction container, by part of day (no hours). */
export default async function DayViewer({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = lifestyleStrings(locale);
  const res = await getReconstructions("day_in_era");
  const days = okData(res);
  const order = (p: string) => DAY_PARTS.indexOf(p as DayPart);
  return (
    <LtaShell locale={locale} section="day" title={t.sections.day} lead={t.sections.dayNote}>
      <p className="lta-notice lta-caution" role="note" data-testid="day-label">
        <b>{t.day.label}.</b> {t.day.note}
      </p>
      {!days.length ? (
        <NoRecords t={t} result={res} />
      ) : (
        days.map((d) => (
          <ReconstructionContainer key={d.id} t={t} title={d.title_en}>
            {d.intro_md ? <Markdown source={d.intro_md} /> : null}
            <ol className="lta-day">
              {d.segments
                .filter(segmentOk)
                .sort((a, b) => order(a.part) - order(b.part))
                .map((s, i) => (
                  <li key={i}>
                    <b>{t.day.parts[s.part as DayPart]}</b>
                    <span>{s.text}</span>
                  </li>
                ))}
            </ol>
            {d.limitations_md ? (
              <div>
                <b>{t.meta.limitations}</b>
                <Markdown source={d.limitations_md} />
              </div>
            ) : null}
            <RecordMeta r={d} t={t} />
          </ReconstructionContainer>
        ))
      )}
      <div className="lta-scenes">
        <Scene scene="pastoral" labels={t.illustration} />
        <Scene scene="empty-market" labels={t.illustration} />
        <Scene scene="tools" labels={t.illustration} />
      </div>
    </LtaShell>
  );
}
