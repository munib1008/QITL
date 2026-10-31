import Link from "next/link";
import "@/styles/qiraat.css";
import { qiraatStrings } from "@/lib/i18n/modules/qiraat";
import { CURRENT_EDITION, READERS, riwayahLabel } from "@/lib/qiraat/model";
import { RiwayahAudio } from "./RiwayahAudio";

/**
 * Always visible above the verses: which riwayah and text edition the reader shows. The other riwayat are listed as
 * unavailable (no licensed text edition yet); they are not links and nothing switches. Audio controls appear only for
 * an approved recording of the same riwayah (RiwayahAudio), otherwise a plain statement.
 */
export function RiwayahIndicator({ locale, surah }: { locale: string; surah: number }) {
  const t = qiraatStrings(locale).riwayah;
  const others = READERS.flatMap((r) => r.riwayat.map((w) => ({ ...w, reader: r }))).filter((w) => w.id !== CURRENT_EDITION.riwayahId);
  return (
    <section className="qr-riwayah" aria-label={t.label} data-testid="riwayah-indicator" data-riwayah={CURRENT_EDITION.riwayahId}>
      <p className="qr-riwayah-now">
        <span className="zq-eyebrow">{t.label}</span>
        <b data-testid="riwayah-current">{t.current}</b>
        <Link href="/qiraat">{t.learn}</Link>
      </p>
      <details data-testid="riwayah-selector">
        <summary>{t.choose}</summary>
        <p className="zq-meta">{t.help}</p>
        <ul>
          {others.map((w) => (
            <li key={w.id} data-riwayah={w.id} data-available="false">
              <span>
                {riwayahLabel(w.id)}{" "}
                <span lang="ar" dir="rtl">
                  {w.nameAr} عن {w.reader.nameAr}
                </span>
              </span>
              <span className="zq-licence zq-licence-pending">{t.unavailable}</span>
            </li>
          ))}
        </ul>
      </details>
      <RiwayahAudio riwayah={CURRENT_EDITION.riwayahId} surah={surah} labels={{ none: t.audioNone, title: t.audioTitle, reciter: t.reciter }} />
    </section>
  );
}
