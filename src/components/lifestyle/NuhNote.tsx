import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import type { LifestyleStrings } from "@/lib/i18n/modules/lifestyle";

/**
 * The fixed Nuh note, exactly as the editorial brief words it: the Quran (29:14) gives the years he remained among
 * his people; his total lifespan is not established by the Quran or the selected authentic hadith.
 */
export function NuhNote({ t }: { t: LifestyleStrings }) {
  return (
    <section className="lta-note" data-testid="nuh-note" aria-labelledby="lta-nuh-h">
      <h3 id="lta-nuh-h">{t.longevity.nuhTitle}</h3>
      <p>{t.longevity.nuh}</p>
      <p style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <EvidenceLabel kind="quran" />
        <CitationChip href="/quran/29#ayah-14">Q 29:14</CitationChip>
        <EvidenceLabel kind="unknown">{t.measures.total_age}: {t.notEstablished}</EvidenceLabel>
      </p>
    </section>
  );
}
