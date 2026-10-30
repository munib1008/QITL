import type { JourneyItem, Journey } from "@/content/journey";
import type { TimelineEra, TimelineItem } from "@/components/ui/VerticalTimeline";
import type { DatePrecision } from "@/components/ui/cards";

/** Journey certainty → timeline mark precision. Relative and disputed eras stay on the relative-order track. */
export function precisionOf(s: JourneyItem): DatePrecision {
  switch (s.era.certainty) {
    case "exact":
      return "exact";
    case "estimate":
      return "estimated";
    case "traditional":
      return "range";
    case "unknown":
      return "unknown";
    default:
      return "relative";
  }
}

/**
 * Builds the master timeline from the journey: eras before recorded chronology are "relative" (no years);
 * the brass break is drawn after the last relative era, with no year attached.
 */
export function journeyTimeline(j: Journey): TimelineEra[] {
  const eras: TimelineEra[] = j.eras.map((e) => {
    const dated = e.items.every((i) => i.dated);
    const items: TimelineItem[] = e.items.map((i) => {
      const pr = precisionOf(i);
      return {
        id: i.id,
        title: `${i.name}${i.honorific ? ` ${i.honorific}` : ""}`,
        precision: pr,
        dateLabel: pr === "relative" ? "Relative order only" : pr === "unknown" ? "Date unknown" : i.era.label,
        evidence: pr === "estimated" ? "estimate" : i.era.certainty === "disputed" ? "disputed" : undefined,
        href: `/timeline?selected=${i.id}`,
      };
    });
    return { title: e.title, kind: dated ? "dated" : "relative", note: e.note, items };
  });
  const lastRelative = eras.map((e) => e.kind).lastIndexOf("relative");
  if (lastRelative >= 0) eras[lastRelative] = { ...eras[lastRelative]!, breakAfter: "Recorded chronology begins" };
  return eras;
}

/** Today's date in CE and in the Hijri calendar (Umm al-Qura, an approximation of the observed calendar). */
export function todayLabel(d = new Date()): string {
  const ce = d.getUTCFullYear();
  let ah = "";
  try {
    ah = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", timeZone: "UTC" }).format(d).replace(/\D+/g, "");
  } catch {
    ah = "";
  }
  return ah ? `${ce} CE · ${ah} AH` : `${ce} CE`;
}
