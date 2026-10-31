"use client";

import { useEffect, useState, type ReactNode } from "react";
import { storyStrings } from "@/lib/i18n/modules/story";
import { useLocale } from "@/lib/i18n/useLocale";

/**
 * Symbolic, environmental animations: water, light, grain, stone and architecture. Never a person, a prophet, an
 * angel or any unseen being, and nothing frightening. Each is shown only when an editor registers it for a story
 * and a scholarly reviewer approves it (story_media). Reduced motion: no autoplay; the reader may still play it.
 */
const SCENES: Record<string, { label: string; render: () => ReactNode }> = {
  "rain-flood": {
    label: "Rain falling and water rising around an ark",
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sky)" />
        {Array.from({ length: 22 }, (_, i) => (
          <line key={i} className="qa-rain" x1={8 + i * 14} y1={-20} x2={4 + i * 14} y2={0} style={{ animationDelay: `${(i % 7) * 0.18}s` }} />
        ))}
        <g className="qa-water">
          <rect x="0" y="150" width="320" height="120" fill="var(--qa-water)" />
          <path d="M0 150 Q40 142 80 150 T160 150 T240 150 T320 150 V160 H0Z" fill="var(--qa-water-hi)" />
        </g>
        <g className="qa-ark">
          <path d="M120 128 H210 L196 146 H134 Z" fill="var(--qa-wood)" />
          <rect x="140" y="112" width="50" height="16" rx="2" fill="var(--qa-wood-hi)" />
        </g>
      </>
    ),
  },
  "sea-path": {
    label: "The sea parting and a dry path appearing",
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sand)" />
        <path className="qa-path" d="M150 180 L170 180 L166 0 L154 0 Z" fill="var(--qa-sand-hi)" />
        <g className="qa-wall-l">
          <rect x="-10" y="0" width="170" height="180" fill="var(--qa-water)" />
          <path d="M150 0 Q160 45 150 90 T150 180 H160 V0Z" fill="var(--qa-water-hi)" />
        </g>
        <g className="qa-wall-r">
          <rect x="160" y="0" width="170" height="180" fill="var(--qa-water)" />
          <path d="M170 0 Q160 45 170 90 T170 180 H160 V0Z" fill="var(--qa-water-hi)" />
        </g>
      </>
    ),
  },
  "wheat-cycles": {
    label: "Seven harvests of wheat growing one after another, then stored",
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-field)" />
        <rect x="0" y="150" width="320" height="30" fill="var(--qa-soil)" />
        {Array.from({ length: 7 }, (_, i) => (
          <g key={i} className="qa-stalk" style={{ animationDelay: `${i * 0.55}s` }} transform={`translate(${30 + i * 40} 150)`}>
            <line x1="0" y1="0" x2="0" y2="-70" stroke="var(--qa-stem)" strokeWidth="3" />
            {[0, 1, 2, 3].map((k) => (
              <ellipse key={k} cx={k % 2 ? 6 : -6} cy={-70 + k * 9} rx="5" ry="9" fill="var(--qa-grain)" />
            ))}
          </g>
        ))}
      </>
    ),
  },
  "cave-daylight": {
    label: "Daylight passing over the mouth of a cave",
    render: () => (
      <>
        <rect className="qa-daysky" width="320" height="180" fill="var(--qa-sky)" />
        <circle className="qa-sun" cx="40" cy="60" r="14" fill="var(--qa-sun)" />
        <path d="M0 180 L0 90 Q80 40 160 70 Q240 40 320 95 L320 180Z" fill="var(--qa-rock)" />
        <path d="M128 180 Q128 118 160 112 Q192 118 192 180Z" fill="var(--qa-cave)" />
      </>
    ),
  },
  "foundations-rising": {
    label: "Foundation stones rising course by course",
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sky)" />
        <rect x="0" y="160" width="320" height="20" fill="var(--qa-sand)" />
        {Array.from({ length: 4 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => (
            <rect
              key={`${row}-${col}`}
              className="qa-stone"
              style={{ animationDelay: `${row * 0.7 + col * 0.12}s` }}
              x={110 + col * 20}
              y={140 - row * 20}
              width="19"
              height="19"
              fill="var(--qa-stone)"
              stroke="var(--qa-stone-hi)"
            />
          )),
        )}
      </>
    ),
  },
  "palace-architecture": {
    label: "Arches and columns of a palace with a shining floor",
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sky)" />
        <rect className="qa-floor" x="0" y="140" width="320" height="40" fill="var(--qa-water-hi)" />
        {Array.from({ length: 5 }, (_, i) => (
          <g key={i} className="qa-arch" style={{ animationDelay: `${i * 0.3}s` }}>
            <path d={`M${30 + i * 56} 140 V80 Q${58 + i * 56} 48 ${86 + i * 56} 80 V140`} fill="none" stroke="var(--qa-gold)" strokeWidth="5" />
          </g>
        ))}
      </>
    ),
  },
  "beginning-timeline": {
    label: "Points of light joining into a line: the beginning of the timeline",
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-night)" />
        <line className="qa-line" x1="20" y1="90" x2="300" y2="90" stroke="var(--qa-gold)" strokeWidth="2" />
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={i} className="qa-dot" style={{ animationDelay: `${i * 0.35}s` }} cx={20 + i * 40} cy="90" r="5" fill="var(--qa-gold)" />
        ))}
      </>
    ),
  },
};

export function AnimationPlayer({ animation, caption, alt, gentle }: { animation: string; caption: string; alt: string; gentle?: boolean }) {
  const scene = SCENES[animation];
  const t = storyStrings(useLocale());
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPlaying(!reduce);
  }, []);
  if (!scene) return null;
  return (
    <figure className="qa" data-playing={playing ? "true" : "false"} data-gentle={gentle ? "true" : undefined}>
      <svg key={run} viewBox="0 0 320 180" role="img" aria-label={alt} className="qa-svg">
        <title>{alt}</title>
        {scene.render()}
      </svg>
      <figcaption>
        <span>{caption}</span>
        <span className="qa-controls">
          <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
            {playing ? t.pause : t.play}
          </button>
          <button
            type="button"
            className="zq-btn zq-btn-quiet zq-btn-sm"
            onClick={() => {
              setRun((r) => r + 1);
              setPlaying(true);
            }}
          >
            {t.replay}
          </button>
        </span>
        <span className="zq-meta qa-note">{t.symbolic}</span>
      </figcaption>
    </figure>
  );
}

export const ANIMATION_KEYS = Object.keys(SCENES);
export const ANIMATION_LABELS = Object.fromEntries(Object.entries(SCENES).map(([k, v]) => [k, v.label]));
