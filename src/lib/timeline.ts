import type { JourneyItem, Journey } from "@/content/journey";
import type { TimelineEra, TimelineItem } from "@/components/ui/VerticalTimeline";
import type { DatePrecision } from "@/components/ui/cards";
import { quranHref } from "@/lib/refs";
import { timelineStrings } from "@/lib/i18n/modules/events";
import { uiStrings } from "@/lib/i18n/modules/ui";

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
export function journeyTimeline(j: Journey, locale = "en"): TimelineEra[] {
  const t = timelineStrings(locale);
  const u = uiStrings(locale);
  const eras: TimelineEra[] = j.eras.map((e) => {
    const dated = e.items.every((i) => i.dated);
    const items: TimelineItem[] = e.items.map((i) => {
      const pr = precisionOf(i);
      return {
        id: i.id,
        title: `${i.name}${i.honorific ? ` ${i.honorific}` : ""}`,
        precision: pr,
        dateLabel: pr === "relative" ? u.precision.relative : pr === "unknown" ? u.precision.unknown : i.era.label,
        evidence: pr === "estimated" ? "estimate" : i.era.certainty === "disputed" ? "disputed" : undefined,
        href: `/timeline?selected=${i.id}`,
        detail: {
          summary: i.summary,
          facts: [
            [t.date, `${i.era.label} — ${u.era[i.era.certainty]}`],
            [t.place, `${u.place[i.place?.certainty ?? "unknown"]}: ${i.place?.name ?? t.unknownPlace}`],
          ],
          refs: (i.surahs ?? [])
            .slice(0, 3)
            .flatMap((su) => su.passages.slice(0, 1))
            .flatMap((p) => {
              const href = quranHref(p);
              return href ? [{ label: `Q ${p}`, href }] : [];
            }),
          links: [
            { label: t.readStory, href: `/prophets/${i.id}`, primary: true },
            { label: t.showOnAtlas, href: `/atlas?focus=${i.id}` },
          ],
        },
      };
    });
    return { title: e.title, kind: dated ? "dated" : "relative", note: e.note, items };
  });
  const lastRelative = eras.map((e) => e.kind).lastIndexOf("relative");
  if (lastRelative >= 0) eras[lastRelative] = { ...eras[lastRelative]!, breakAfter: t.chronologyBegins };
  return eras;
}

/** Today's date in CE and in the Hijri calendar (Umm al-Qura, an approximation of the observed calendar). */
export function todayLabel(d = new Date(), locale = "en"): string {
  const t = timelineStrings(locale);
  const ce = d.getUTCFullYear();
  let ah = "";
  try {
    ah = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", timeZone: "UTC" }).format(d).replace(/\D+/g, "");
  } catch {
    ah = "";
  }
  return ah ? `${ce} ${t.ce} · ${ah} ${t.ah}` : `${ce} ${t.ce}`;
}
