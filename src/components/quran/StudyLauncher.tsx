"use client";

import { useId, useState } from "react";
import { interpretationT } from "@/lib/i18n/modules/interpretation";
import { StudyLayout, type StudyTarget } from "./StudyPanel";

/**
 * Shown when the verified Arabic is not imported: the reader can still open the Study panel for an ayah number to see
 * which editions are registered and what is pending. The panel then shows the designed "not loaded" Arabic state.
 * The ayah count comes only from the pinned source metadata; without it the number is limited to the longest surah.
 */
export function StudyLauncher({ surah, maxAyah, related, locale = "en" }: { surah: number; maxAyah: number | null; related: Record<number, Array<{ id: string; name: string }>>; locale?: string }) {
  const t = interpretationT(locale);
  const id = useId();
  const max = maxAyah ?? 286;
  const [ayah, setAyah] = useState(1);
  const [target, setTarget] = useState<StudyTarget | null>(null);
  const valid = Number.isInteger(ayah) && ayah >= 1 && ayah <= max;
  return (
    <StudyLayout target={target} locale={locale} onClose={() => setTarget(null)}>
      <section className="pp-card qs-launcher" aria-labelledby={`${id}-h`}>
        <h2 id={`${id}-h`}>{t.launcherTitle}</h2>
        <p className="zq-meta">{t.launcherHelp}</p>
        <form
          className="qs-launch-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) setTarget({ surah, ayah, arabic: null, related: related[ayah] ?? [] });
          }}
        >
          <div className="zq-field">
            <label htmlFor={`${id}-n`}>{t.pickAyah}</label>
            <input id={`${id}-n`} className="zq-input" type="number" inputMode="numeric" min={1} max={max} value={Number.isFinite(ayah) ? ayah : ""} onChange={(e) => setAyah(e.target.valueAsNumber)} dir="ltr" />
          </div>
          <button type="submit" className="zq-btn zq-btn-primary qs-study-btn" aria-haspopup="dialog" disabled={!valid}>
            {t.studyAyah(`Q ${surah}:${valid ? ayah : "…"}`)}
          </button>
        </form>
      </section>
    </StudyLayout>
  );
}
