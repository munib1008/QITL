import "server-only";
import { eventStrings } from "@/lib/i18n/modules/events";
import { uiStrings } from "@/lib/i18n/modules/ui";
import type { EvidenceKind } from "@/content/labels";
import type { DatePrecision } from "@/components/ui/cards";
import type { TimelineEra } from "@/components/ui/VerticalTimeline";
import { getPublicSupabase } from "@/lib/supabase/server";
import { formatRange } from "@/lib/years";

export interface PublishedEvent {
  id: string;
  slug: string;
  title: string;
  title_ar: string | null;
  summary: string | null;
  category: "sacred_history" | "prophetic_life" | "islamic_history";
  date_precision: DatePrecision;
  relative_order: number | null;
  start_year: number | null;
  end_year: number | null;
  start_ah: number | null;
  end_ah: number | null;
  evidence_claims: { evidence: EvidenceKind } | null;
}

/** Published events (never the Last Hour, which has no place on a dated timeline). */
export async function publishedEvents(): Promise<PublishedEvent[] | null> {
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("historical_events")
    .select("id, slug, title, title_ar, summary, category, date_precision, relative_order, start_year, end_year, start_ah, end_ah, evidence_claims(evidence)")
    .eq("status", "published")
    .in("category", ["sacred_history", "prophetic_life", "islamic_history"])
    .order("relative_order", { ascending: true, nullsFirst: false })
    .order("start_year", { ascending: true, nullsFirst: true })
    .limit(500);
  if (error) return null;
  return (data ?? []) as unknown as PublishedEvent[];
}

/** Reviewed events as timeline eras: sacred history in relative order (no years), dated history with CE and AH. */
export function eventEras(events: PublishedEvent[], locale = "en"): TimelineEra[] {
  const t = eventStrings(locale);
  const precision = uiStrings(locale).precision;
  return (["sacred_history", "prophetic_life", "islamic_history"] as const)
    .map((cat) => {
      const items = events.filter((e) => e.category === cat);
      const relative = items.every((e) => e.date_precision === "relative" || e.date_precision === "unknown");
      return {
        title: t.groups[cat],
        kind: relative ? ("relative" as const) : ("dated" as const),
        items: items.map((e) => ({
          id: `event-${e.slug}`,
          title: e.title,
          precision: e.date_precision,
          dateLabel: formatRange(e.start_year, e.end_year, e.start_ah, e.end_ah, e.date_precision === "estimated"),
          evidence: e.evidence_claims?.evidence,
          href: `/timeline?selected=event-${e.slug}`,
          detail: {
            summary: e.summary ?? undefined,
            facts: [[t.date, precision[e.date_precision]] as [string, string]],
            refs: [],
            links: [{ label: t.readAbout, href: `/events/${e.slug}`, primary: true }],
          },
        })),
      };
    })
    .filter((e) => e.items.length);
}
