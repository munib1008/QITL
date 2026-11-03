"use client";

import { useMemo, useState } from "react";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import type { LineageBranch, LineageNode } from "@/content/draftAtlas";
import { useNearestSpy } from "./useScrollSpy";

export interface LineageStrings {
  modeLabel: string;
  whole: string;
  prophets: string;
  gaps: string;
  progress: string;
  inView: string;
  preview: string;
  selected: string;
  draftBanner: string;
  roles: Record<LineageNode["role"], string>;
  classes: Record<"quran" | "hadith" | "scholar" | "disputed" | "unknown", string>;
  legend: string;
}
type Mode = "all" | "prophets" | "gaps";
const ayahHref = (ref: string) => {
  const m = /^(\d{1,3}):(\d{1,3})/.exec(ref);
  return m ? `/quran/${m[1]}#ayah-${m[2]}` : undefined;
};

/**
 * The line from Adam to Muhammad ﷺ as a scroll story (draft content, labelled). The link into each person is drawn with the
 * pattern of its source (solid Quran, dashed scholarship, dotted not established), so colour is never the only signal. The
 * line lights up as the reader scrolls; one calm focus card follows the person in view, previews on hover, pins on click.
 */
export function LineageLine({ spine, branches, s, englishAttrs }: { spine: LineageNode[]; branches: LineageBranch[]; s: LineageStrings; englishAttrs: { lang?: string; dir?: string } }) {
  const [mode, setMode] = useState<Mode>("all");
  const [pin, setPin] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const nearest = useNearestSpy([mode]);
  const all = useMemo(() => new Map([...spine, ...branches.flatMap((b) => b.nodes)].map((n) => [n.id, n])), [spine, branches]);
  const activeId = nearest && spine.some((n) => n.id === nearest) ? nearest : spine[0]!.id;
  const activeIdx = Math.max(0, spine.findIndex((n) => n.id === activeId));
  const focusId = hov ?? pin ?? activeId;
  const focus = all.get(focusId) ?? spine[0]!;
  const how = hov ? s.preview : pin ? s.selected : s.inView;
  const dim = (n: LineageNode) => (mode === "prophets" ? n.role !== "prophet" : mode === "gaps" ? n.role !== "gap" : false);
  const prog = spine.length > 1 ? activeIdx / (spine.length - 1) : 0;
  const modes: Array<[Mode, string]> = [["all", s.whole], ["prophets", s.prophets], ["gaps", s.gaps]];

  return (
    <div className="rd-scroll" data-testid="lineage-line">
      <p className="tl-synthetic" role="note" data-testid="draft-banner">
        {s.draftBanner}
      </p>
      <p className="zq-meta">{s.legend}</p>
      <div className="rd-cats" role="group" aria-label={s.modeLabel}>
        {modes.map(([m, label]) => (
          <button key={m} type="button" className="rd-chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {label}
          </button>
        ))}
      </div>
      <div className="rd-split">
        <aside className="rd-stage">
          <div className="rd-progress" role="progressbar" aria-label={s.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(prog * 100)}>
            <span style={{ width: `${prog * 100}%` }} />
          </div>
          <div className="rd-card rd-focus" aria-live="polite" data-testid="focus-card">
            <div className="rd-focus-head">
              <span className="rd-node-ic rd-node-ic-lg" data-role={focus.role} aria-hidden="true" />
              <div>
                <p className="rd-eyebrow">
                  {s.roles[focus.role]} · {how}
                </p>
                <p className="rd-focus-title" {...englishAttrs}>
                  {focus.name} <span className="zq-meta">{focus.honorific}</span>
                </p>
              </div>
            </div>
            {focus.arabic ? (
              <p lang="ar" dir="rtl" className="rd-focus-ar">
                {focus.arabic}
              </p>
            ) : null}
            <p className="rd-small" {...englishAttrs}>
              {focus.note}
            </p>
            <div className="rd-chips">
              {focus.evidence.map((k) => (
                <EvidenceLabel key={k} kind={k === "quran" || k === "hadith" || k === "scholar" || k === "disputed" || k === "unknown" ? k : "unknown"}>
                  {s.classes[k === "quran" || k === "hadith" || k === "scholar" || k === "disputed" || k === "unknown" ? k : "unknown"]}
                </EvidenceLabel>
              ))}
              {focus.refs.map((r) => (/^\d/.test(r) ? <CitationChip key={r} href={ayahHref(r)}>{`Q ${r}`}</CitationChip> : <CitationChip key={r}>{r}</CitationChip>))}
            </div>
          </div>
        </aside>

        <ol className="rd-line">
          {spine.map((n, idx) => {
            const lit = idx <= activeIdx;
            const branch = branches.find((b) => b.after === n.id);
            return (
              <li key={n.id} className="rd-line-item">
                <div className="rd-line-row" data-node={n.id} data-link={n.link} data-lit={lit} data-dim={dim(n)} data-first={idx === 0} data-last={idx === spine.length - 1}>
                  <button
                    type="button"
                    className="rd-person"
                    data-role={n.role}
                    aria-pressed={focusId === n.id}
                    onClick={() => setPin((p) => (p === n.id ? null : n.id))}
                    onMouseEnter={() => setHov(n.id)}
                    onMouseLeave={() => setHov((h) => (h === n.id ? null : h))}
                    onFocus={() => setHov(n.id)}
                    onBlur={() => setHov((h) => (h === n.id ? null : h))}
                  >
                    <span className="rd-node-ic" data-role={n.role} aria-hidden="true" />
                    <span className="rd-person-text">
                      <span className="rd-person-name" {...englishAttrs}>
                        {n.name}
                      </span>
                      <span className="zq-meta" {...englishAttrs}>
                        {n.subtitle}
                      </span>
                    </span>
                    {n.arabic ? (
                      <span lang="ar" dir="rtl" className="rd-person-ar">
                        {n.arabic}
                      </span>
                    ) : null}
                  </button>
                </div>
                {branch ? (
                  <div className="rd-branch" data-dim={mode === "gaps"}>
                    <p className="rd-eyebrow" {...englishAttrs}>
                      {branch.title}
                    </p>
                    <div className="rd-chips">
                      {branch.nodes.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className="rd-chip"
                          aria-pressed={focusId === b.id}
                          onClick={() => setPin((p) => (p === b.id ? null : b.id))}
                          onMouseEnter={() => setHov(b.id)}
                          onMouseLeave={() => setHov((h) => (h === b.id ? null : h))}
                        >
                          <span {...englishAttrs}>{b.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
