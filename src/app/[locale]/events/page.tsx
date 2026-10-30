import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { PRECISION_TEXT } from "@/components/ui/cards";
import { publishedEvents } from "@/lib/data/events";
import { formatRange } from "@/lib/years";

export const metadata: Metadata = {
  title: "Quranic events",
  description: "Events established by the Quran and authenticated narrations, each told in the same structure with its evidence.",
};
export const revalidate = 300;

const GROUP = { sacred_history: "Sacred history", prophetic_life: "The life of the Prophet ﷺ", islamic_history: "Islamic history" } as const;

export default async function EventsIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const events = await publishedEvents();
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: "Quranic events" }]}
      title="Quranic events"
      lead="Events established by the Quran and authenticated narrations, each told in the same structure and connected to its prophets, places and the timeline."
    >
      <div className="zq-pagebody">
        {events?.length ? (
          (Object.keys(GROUP) as Array<keyof typeof GROUP>).map((g) => {
            const list = events.filter((e) => e.category === g);
            if (!list.length) return null;
            return (
              <section key={g} aria-labelledby={`g-${g}`}>
                <h2 id={`g-${g}`} className="zq-eyebrow">
                  {GROUP[g]}
                </h2>
                <div className="zq-grid" style={{ marginTop: 8 }}>
                  {list.map((e) => (
                    <Link key={e.slug} href={`/events/${e.slug}`} className="zq-card" style={{ textDecoration: "none", color: "var(--ink)", maxWidth: "none" }}>
                      <p className="zq-eyebrow">{formatRange(e.start_year, e.end_year, e.start_ah, e.end_ah, e.date_precision === "estimated") ?? PRECISION_TEXT[e.date_precision]}</p>
                      <h3 className="zq-title" style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
                        {e.title}{" "}
                        {e.title_ar ? (
                          <span lang="ar" dir="rtl" className="zq-jc-sar">
                            {e.title_ar}
                          </span>
                        ) : null}
                      </h3>
                      {e.summary ? <p className="zq-meta">{e.summary}</p> : null}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <EmptyState
            label={<EvidenceLabel kind="unknown">None published yet</EvidenceLabel>}
            title={events ? "No events are published yet." : "The events encyclopedia is not connected yet."}
          >
            <p>
              Each event is written from the Quran and authenticated narrations and appears only after scholarly review. Where no date is known, its
              order is relative or marked unknown.
            </p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
