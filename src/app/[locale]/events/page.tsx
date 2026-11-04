import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { AiDraftIndex } from "@/components/drafts/AiDraftIndex";
import { EmptyState } from "@/components/ui/misc";
import { publishedEvents } from "@/lib/data/events";
import { englishContent } from "@/lib/i18n/locales";
import { eventStrings } from "@/lib/i18n/modules/events";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { formatRange } from "@/lib/years";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = eventStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}
export const revalidate = 300;

const GROUPS = ["sacred_history", "prophetic_life", "islamic_history"] as const;

export default async function EventsIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = eventStrings(locale);
  const precision = uiStrings(locale).precision;
  const en = englishContent(locale);
  const events = await publishedEvents();
  return (
    <ReadingPage locale={locale} crumbs={[{ label: t.title }]} title={t.title} lead={t.lead}>
      <div className="zq-pagebody">
        {events?.length ? (
          GROUPS.map((g) => {
            const list = events.filter((e) => e.category === g);
            if (!list.length) return null;
            return (
              <section key={g} aria-labelledby={`g-${g}`}>
                <h2 id={`g-${g}`} className="zq-eyebrow">
                  {t.groups[g]}
                </h2>
                <div className="zq-grid" style={{ marginTop: 8 }}>
                  {list.map((e) => (
                    <Link key={e.slug} href={`/events/${e.slug}`} className="zq-card" style={{ textDecoration: "none", color: "var(--ink)", maxWidth: "none" }}>
                      <p className="zq-eyebrow">{formatRange(e.start_year, e.end_year, e.start_ah, e.end_ah, e.date_precision === "estimated") ?? precision[e.date_precision]}</p>
                      <h3 className="zq-title" style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
                        <span {...en}>{e.title}</span>{" "}
                        {e.title_ar ? (
                          <span lang="ar" dir="rtl" className="zq-jc-sar">
                            {e.title_ar}
                          </span>
                        ) : null}
                      </h3>
                      {e.summary ? (
                        <p className="zq-meta" {...en}>
                          {e.summary}
                        </p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <EmptyState
            label={<EvidenceLabel kind="unknown">{t.nonePublished}</EvidenceLabel>}
            title={events ? t.emptyTitle : t.notConnected}
          >
            <p>{t.emptyBody}</p>
          </EmptyState>
        )}
        <AiDraftIndex types={["event", "parable", "seerah"]} locale={locale} />
      </div>
    </ReadingPage>
  );
}
