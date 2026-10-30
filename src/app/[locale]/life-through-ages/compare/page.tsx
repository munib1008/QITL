import type { Metadata } from "next";
import { BASE, LtaShell, okData } from "@/components/lifestyle/Shell";
import { RecordCard } from "@/components/lifestyle/Evidence";
import { Scene } from "@/components/lifestyle/Scene";
import { lifestyleStrings, type LifestyleStrings } from "@/lib/i18n/modules/lifestyle";
import { getTopicRecords, type TopicRecord } from "@/lib/lifestyle/data";

export const metadata: Metadata = { title: "Then and now · Life Through the Ages", alternates: { canonical: `${BASE}/compare` } };
export const revalidate = 300;

const TOPICS = [
  ["historical_occupations", "occupation"],
  ["historical_housing", "housing"],
  ["historical_transport", "transport"],
  ["historical_daily_activities", "daily_activities"],
  ["historical_health_conditions", "health_treatment"],
] as const;
const BANDS = ["ancient", "documented", "contemporary"] as const;

/** Ancient → documented → contemporary: each cell shows its own records with their evidence and limitations. */
export default async function ComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = lifestyleStrings(locale);
  const results = await Promise.all(TOPICS.map(([table]) => getTopicRecords(table)));
  const configured = results.every((r) => r.state !== "not_configured");
  return (
    <LtaShell locale={locale} section="compare" title={t.sections.compare} lead={t.sections.compareNote}>
      <p className="lta-notice">{t.compare.intro}</p>
      {!configured ? <p className="zq-meta">{t.notConfigured}</p> : null}
      <div className="zq-tablewrap">
        <table className="lta-compare" data-testid="compare-table">
          <caption className="sr-only">{t.sections.compare}</caption>
          <thead>
            <tr>
              <th scope="col">{t.compare.topic}</th>
              {BANDS.map((b) => (
                <th key={b} scope="col">
                  {t.compare[b]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TOPICS.map(([table, field], i) => {
              const rows = okData(results[i]!);
              return (
                <tr key={table}>
                  <th scope="row">{t.fields[field]}</th>
                  {BANDS.map((b) => (
                    <td key={b} data-col={t.compare[b]}>
                      <Cell rows={rows.filter((r) => r.comparison_band === b)} t={t} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="lta-scenes">
        <Scene scene="mud-brick" labels={t.illustration} />
        <Scene scene="ship" labels={t.illustration} />
      </div>
    </LtaShell>
  );
}

function Cell({ rows, t }: { rows: TopicRecord[]; t: LifestyleStrings }) {
  if (!rows.length) return <span className="zq-meta">{t.notEstablished}</span>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r) => (
        <RecordCard key={r.id} r={r} t={t} title={r.title} body={r.body} />
      ))}
    </div>
  );
}
