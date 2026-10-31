import type { ReactNode } from "react";
import "@/styles/qa.css";
import { CitationChip } from "@/components/ui/evidence";
import { citationDisplay, type CitationRow } from "@/lib/mufti";

/** Presentational pieces shared by Mufti Q&A and the Dream Centre (server-safe, no hooks). */

export function VerifiedBadge({ children }: { children: ReactNode }) {
  return (
    <span className="qa-badge" data-testid="verified-mufti">
      <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true" focusable="false">
        <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </span>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="qa-pill">{children}</span>;
}

export type HadithLookup = Record<string, { collection_id: string; canonical_number: string } | undefined>;

/** Citation cards: the reference is always visible (never behind hover); Quran references link to the reader. */
export function CitationList({
  cites,
  labels,
  hadith = {},
  empty,
}: {
  cites: CitationRow[];
  labels: { quran: string; hadith: string; scholar: string };
  hadith?: HadithLookup;
  empty: string;
}) {
  if (!cites.length) return <p className="zq-meta">{empty}</p>;
  return (
    <ul className="qa-cites" data-testid="citations">
      {cites.map((c, i) => {
        const d = citationDisplay(c);
        const h = c.hadith_id ? hadith[c.hadith_id] : undefined;
        const label = h ? `${h.collection_id} ${h.canonical_number}` : d.label;
        const href = h ? `/hadith/${h.collection_id}/${h.canonical_number}` : d.href;
        return (
          <li key={c.id ?? i} className="qa-cite">
            <CitationChip kind={labels[c.kind]} href={href}>
              {label}
            </CitationChip>
            {c.note ? <small>{c.note}</small> : null}
          </li>
        );
      })}
    </ul>
  );
}
