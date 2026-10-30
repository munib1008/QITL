import type { ReactNode } from "react";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { Markdown } from "@/components/ui/Markdown";
import { EVIDENCE_KIND, refLabel, type Entry, type EvidenceClass, type Ref } from "@/lib/data/creation-types";
import type { CreationStrings } from "@/lib/i18n/modules/creation";

/** The evidence class of a Creation Atlas entry: always the word, the mark and the border, never colour alone. */
export function EvidenceClassBadge({ cls, t, lang }: { cls: EvidenceClass; t: CreationStrings; lang?: "en" | "ar" }) {
  return (
    <span data-evidence-class={cls}>
      <EvidenceLabel kind={EVIDENCE_KIND[cls]} lang={lang} title={t.evidenceHelp[cls]}>
        {t.evidence[cls]}
      </EvidenceLabel>
    </span>
  );
}

/** Visible citations. Quran references open the verified text; hadith references open the narration. */
export function Citations({ refs }: { refs: Ref[] }) {
  if (!refs.length) return null;
  return (
    <>
      {refs.map((r, i) => {
        const l = refLabel(r);
        return (
          <CitationChip key={`${l.text}-${i}`} href={l.href} kind={r.kind === "hadith" && r.hadith?.grade ? r.hadith.grade : undefined}>
            {l.text}
          </CitationChip>
        );
      })}
    </>
  );
}

/** The fixed sentence for anything the selected authentic sources do not establish. */
export function NotEstablished({ t }: { t: CreationStrings }) {
  return (
    <p className="cr-unknown" data-not-established="">
      <EvidenceClassBadge cls="not_established" t={t} />
      <span>{t.notEstablished}</span>
    </p>
  );
}

/** One published entry: its text (or the not-established sentence), evidence class and citations. */
export function EntryBlock({ entry, t, heading, compact }: { entry: Entry; t: CreationStrings; heading?: ReactNode; compact?: boolean }) {
  if (!entry.known)
    return (
      <div className="cr-entry" data-entry={entry.id}>
        {entry.title ? <b className="cr-entry-title">{entry.title}</b> : null}
        <NotEstablished t={t} />
      </div>
    );
  return (
    <div className="cr-entry" data-entry={entry.id}>
      {heading ?? (entry.title ? <b className="cr-entry-title">{entry.title}</b> : null)}
      <div className={compact ? "cr-entry-body cr-compact" : "cr-entry-body zq-prose"}>
        <Markdown source={entry.bodyMd} />
      </div>
      {entry.everydayApplication ? (
        <p className="cr-everyday">
          <span className="zq-eyebrow">{t.profile.everyday}</span> {entry.everydayApplication}
        </p>
      ) : null}
      <span className="cr-refs">
        <EvidenceClassBadge cls={entry.evidence} t={t} />
        <Citations refs={entry.refs} />
      </span>
    </div>
  );
}

/** Two versions of a label: the default and the kids-mode wording. CSS shows the one that fits the mode. */
export function Dual({ normal, kids }: { normal: ReactNode; kids?: ReactNode }) {
  if (!kids || kids === normal) return <>{normal}</>;
  return (
    <>
      <span className="cr-adult-only">{normal}</span>
      <span className="cr-kids-only">{kids}</span>
    </>
  );
}
