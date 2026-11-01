"use client";

import { lineStyleFor, LINEAGE_CLASSES, type LineageClass } from "@/lib/lineage/classes";
import { lineageStrings } from "@/lib/i18n/modules/lineage";
import { useLocale } from "@/lib/i18n/useLocale";

/** A short sample of a class's line pattern; decorative (the pattern is also named in text wherever it matters). */
export function LineSample({ cls, width = 28 }: { cls: LineageClass; width?: number }) {
  const { dasharray, pattern } = lineStyleFor(cls);
  return (
    <svg width={width} height="8" viewBox={`0 0 ${width} 8`} aria-hidden="true" focusable="false" data-pattern={pattern}>
      <line x1="0" y1="4" x2={width} y2="4" strokeDasharray={dasharray === "none" ? undefined : dasharray} />
    </svg>
  );
}

/** The class as a chip: colour, line sample AND the class name in words. */
export function EvidenceChip({ cls, short = false }: { cls: LineageClass; short?: boolean }) {
  const t = lineageStrings(useLocale());
  return (
    <span className="ln-chip" data-class={cls} data-pattern={lineStyleFor(cls).pattern}>
      <LineSample cls={cls} />
      <span>{short ? t.classes[cls].short : t.classes[cls].name}</span>
    </span>
  );
}

/** The legend: every class with its line pattern, its name and what it means. */
export function EvidenceLegend() {
  const t = lineageStrings(useLocale());
  return (
    <section className="ln-legend" aria-labelledby="ln-legend-h">
      <h2 id="ln-legend-h" className="zq-eyebrow">
        {t.legendTitle}
      </h2>
      <p className="zq-meta" style={{ margin: 0 }}>
        {t.legendIntro}
      </p>
      <ul>
        {LINEAGE_CLASSES.map((c) => (
          <li key={c} data-class={c}>
            <EvidenceChip cls={c} />
            <p className="zq-meta">
              {t.patterns[lineStyleFor(c).pattern]} · {t.classes[c].note}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
