"use client";

import { useEffect, useRef } from "react";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { refLabel } from "@/lib/data/story-types";
import type { PlayerScene, SceneClaim } from "@/lib/player/types";
import type { PlayerStrings } from "@/lib/i18n/modules/player";

type P = PlayerStrings["player"];

export function ClaimRefs({ claims, t }: { claims: SceneClaim[]; t: P }) {
  if (!claims.length) return <p className="zq-meta qp-norefs">{t.noRefs}</p>;
  return (
    <ul className="qp-claims">
      {claims.map((c) => (
        <li key={c.id}>
          <EvidenceLabel kind={c.evidence} />
          <span className="qp-claim-text">{c.statement}</span>
          <span className="qp-chips">
            {c.refs.map((r, i) => {
              const l = refLabel(r);
              return (
                <CitationChip key={i} href={l.href} kind={r.kind === "hadith" && r.hadith?.grade ? r.hadith.grade : undefined}>
                  {l.text}
                </CitationChip>
              );
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Scenes (chapters), the position in the story, the current scene's references and lessons. */
export function EvidencePanel({
  scenes,
  index,
  onJump,
  t,
  headingLevel = 3,
}: {
  scenes: PlayerScene[];
  index: number;
  onJump: (i: number) => void;
  t: P;
  headingLevel?: 2 | 3;
}) {
  const scene = scenes[index];
  const H = headingLevel === 2 ? "h2" : "h3";
  const lessons = scene ? [...scene.lessons] : [];
  return (
    <div className="qp-panel">
      <section>
        <H className="qp-panel-h">{t.position}</H>
        <progress className="qp-progress" max={scenes.length} value={index + 1} aria-label={t.sceneOf(index + 1, scenes.length)} />
        <p className="zq-meta qp-pos">{t.sceneOf(index + 1, scenes.length)}</p>
      </section>
      <section>
        <H className="qp-panel-h">{t.scenes}</H>
        <ol className="qp-chapters">
          {scenes.map((s, i) => (
            <li key={s.id}>
              <button type="button" className="qp-chapter" aria-current={i === index ? "step" : undefined} onClick={() => onJump(i)}>
                <span className="qp-chapter-kind">{t.kinds[s.kind]}</span>
                <span>{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <H className="qp-panel-h">{t.references}</H>
        {scene ? <ClaimRefs claims={scene.claims} t={t} /> : null}
      </section>
      {lessons.length ? (
        <section>
          <H className="qp-panel-h">{t.lessons}</H>
          <ul className="qp-lessons">
            {lessons.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Mobile bottom sheet: a modal dialog; Esc and the backdrop close it, focus returns to the opener. */
export function BottomSheet({ open, onClose, title, closeLabel, children }: { open: boolean; onClose: () => void; title: string; closeLabel: string; children: React.ReactNode }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="qp-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="qp-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="qb-grip" aria-hidden="true" />
        <div className="qp-sheet-head">
          <h2>{title}</h2>
          <button ref={closeBtn} type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
