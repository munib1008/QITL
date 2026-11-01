"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { CitationChip } from "@/components/ui/evidence";
import { englishContent } from "@/lib/i18n/locales";
import { lineageStrings } from "@/lib/i18n/modules/lineage";
import { useLocale } from "@/lib/i18n/useLocale";
import { ayahHash } from "@/lib/refs";
import type { LineageClaim, LineageDoc, LineageReference } from "@/lib/lineage/types";
import { EvidenceChip } from "./EvidenceChip";

export type Selection = { kind: "person" | "link" | "gap"; id: string } | null;

type T = ReturnType<typeof lineageStrings>;

function Reference({ r, t }: { r: LineageReference; t: T }) {
  if (r.kind === "quran" && r.surah) {
    return (
      <li>
        <CitationChip href={`/quran/${r.surah}${ayahHash(r.from ?? 1, r.to ?? undefined)}`}>{`Q ${r.surah}:${r.from}${r.to && r.to !== r.from ? `–${r.to}` : ""}`}</CitationChip>
      </li>
    );
  }
  if (r.kind === "scripture" && r.witness) {
    return (
      <li>
        <Link className="zq-chip" href={`/scriptures#${r.witness.slug}`} data-citation="">
          <span dir="ltr">{t.witnessAt(r.witness.name, r.locator ?? "")}</span>
        </Link>
      </li>
    );
  }
  return (
    <li>
      <CitationChip kind={r.kind}>{[r.source, r.locator].filter(Boolean).join(", ") || r.kind}</CitationChip>
    </li>
  );
}

function ClaimBlock({ claim, t, en }: { claim: LineageClaim; t: T; en: { lang?: string; dir?: string } }) {
  return (
    <>
      <dl>
        <dt>{t.claimLabel}</dt>
        <dd {...en}>{claim.statement}</dd>
      </dl>
      <dl>
        <dt>{t.referencesLabel}</dt>
        <dd>{claim.references.length ? <ul className="ln-refs">{claim.references.map((r, i) => <Reference key={i} r={r} t={t} />)}</ul> : t.noReferences}</dd>
      </dl>
    </>
  );
}

/**
 * "What we know / how we know / what is uncertain" for one selected person, link or gap. Everything shown comes from a
 * published, reviewed row; a missing piece reads "Not established".
 */
export const AssessmentPanel = forwardRef<HTMLElement, { doc: LineageDoc; sel: Selection; nameOf: (id: string) => string; onClear: () => void }>(function AssessmentPanel({ doc, sel, nameOf, onClear }, ref) {
  const locale = useLocale();
  const t = lineageStrings(locale);
  const en = englishContent(locale);
  const link = sel?.kind === "link" ? doc.links.find((l) => l.id === sel.id) : undefined;
  const gap = sel?.kind === "gap" ? doc.gaps.find((g) => g.id === sel.id) : undefined;
  const person = sel?.kind === "person" ? doc.people.find((p) => p.id === sel.id) : undefined;
  const item = link ?? gap;

  const siblings = item
    ? [...doc.links, ...doc.gaps].filter((o) => o.id !== item.id && o.ancestor === item.ancestor && o.descendant === item.descendant)
    : [];
  const hasScripture = !!item && (item.evidenceClass === "scripture" || item.referenceClasses.includes("scripture"));

  return (
    <section ref={ref} className="ln-panel" aria-labelledby="ln-panel-h" aria-live="polite" tabIndex={-1} data-selected={sel ? `${sel.kind}:${sel.id}` : undefined}>
      <p className="zq-eyebrow">{t.panelTitle}</p>
      {!sel || (!item && !person) ? (
        <p className="zq-meta" id="ln-panel-h">
          {t.panelNone}
        </p>
      ) : person ? (
        <>
          <h3 id="ln-panel-h" {...(locale === "ar" && person.nameAr ? {} : en)}>
            {t.personClaims(locale === "ar" && person.nameAr ? person.nameAr : person.name)}
          </h3>
          {doc.nodeClaims.filter((n) => n.person === person.id).length ? (
            doc.nodeClaims
              .filter((n) => n.person === person.id)
              .map((n) => (
                <article key={n.id} style={{ display: "grid", gap: 8 }}>
                  <h4>{t.personAspects[n.aspect]}</h4>
                  <EvidenceChip cls={n.evidenceClass} />
                  <ClaimBlock claim={n.claim} t={t} en={en} />
                  {n.note ? (
                    <dl>
                      <dt>{t.uncertain}</dt>
                      <dd {...en}>{n.note}</dd>
                    </dl>
                  ) : null}
                </article>
              ))
          ) : (
            <p>
              <b>{t.notEstablished}.</b> {t.personNone}
            </p>
          )}
          {(["lifespan", "dates"] as const)
            .filter((a) => !doc.nodeClaims.some((n) => n.person === person.id && n.aspect === a))
            .map((a) => (
              <dl key={a}>
                <dt>{t.personAspects[a]}</dt>
                <dd>{t.notEstablished}</dd>
              </dl>
            ))}
        </>
      ) : item ? (
        <>
          <h3 id="ln-panel-h">
            {link ? t.linkWord : t.gapTitle}: <span {...en}>{nameOf(item.ancestor)}</span> → <span {...en}>{nameOf(item.descendant)}</span>
          </h3>
          <section aria-label={t.know} style={{ display: "grid", gap: 8 }}>
            <h4>{t.know}</h4>
            {gap ? (
              <p {...en}>
                <b>{t.gapBody}</b> {gap.note}
              </p>
            ) : (
              <p {...en}>{item.claim.statement}</p>
            )}
          </section>
          <section aria-label={t.how} style={{ display: "grid", gap: 8 }}>
            <h4>{t.how}</h4>
            <dl>
              <dt>{t.classLabel}</dt>
              <dd style={{ display: "grid", gap: 6 }}>
                <span>
                  <EvidenceChip cls={item.evidenceClass} />
                </span>
                <span className="zq-meta">{t.classes[item.evidenceClass].note}</span>
              </dd>
            </dl>
            <ClaimBlock claim={item.claim} t={t} en={en} />
            {hasScripture ? (
              <p className="ln-caution">
                {t.scriptureCaution} <Link href="/scriptures">{t.aboutScriptures}</Link>
              </p>
            ) : null}
          </section>
          <section aria-label={t.uncertain} style={{ display: "grid", gap: 8 }}>
            <h4>{t.uncertain}</h4>
            {link?.uncertainty ? <p {...en}>{link.uncertainty}</p> : gap ? <p>{t.gapAssessNote}</p> : <p>{t.noUncertainty}</p>}
            <dl>
              <dt>{t.traditionLabel}</dt>
              <dd {...(item.tradition ? en : {})}>{item.tradition ?? t.notEstablished}</dd>
            </dl>
            <dl>
              <dt>{t.disagreementLabel}</dt>
              <dd>
                {item.competingGroup || siblings.length ? (
                  <>
                    {t.competingNote}
                    <ul className="ln-refs" style={{ marginTop: 8 }}>
                      {siblings.map((s) => (
                        <li key={s.id}>
                          <EvidenceChip cls={s.evidenceClass} short />
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  t.notEstablished
                )}
              </dd>
            </dl>
          </section>
        </>
      ) : null}
      {sel ? (
        <div>
          <button type="button" className="zq-btn zq-btn-quiet ln-btn" onClick={onClear}>
            {t.close}
          </button>
        </div>
      ) : null}
    </section>
  );
});
