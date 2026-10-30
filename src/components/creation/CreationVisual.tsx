"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { VisualKey } from "@/lib/data/creation-types";

/**
 * Abstract, environmental, calligraphic or diagrammatic scenes for the Creation Atlas (the pattern of
 * src/components/story/AnimationPlayer.tsx). Never a figure of a prophet, an angel, a jinn, Iblis or anything unseen,
 * and nothing frightening: slow light, water, growth and line only. Reduced motion: no autoplay; the reader may play.
 * The calligraphic scene draws abstract strokes, never words, so no text is written into the image.
 */
const SCENES: Record<VisualKey, { label: string; render: () => ReactNode }> = {
  orbits: {
    label: "Concentric orbits with small points of light moving slowly along them",
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--cr-night)" />
        {[30, 52, 74].map((r, i) => (
          <g key={r} className="cr-orbit" style={{ animationDuration: `${24 + i * 10}s`, animationDirection: i % 2 ? "reverse" : "normal" }}>
            <ellipse cx="160" cy="90" rx={r * 1.9} ry={r} fill="none" stroke="var(--cr-line)" strokeWidth="1" />
            <circle cx={160 + r * 1.9} cy="90" r="3.5" fill="var(--cr-gold)" />
          </g>
        ))}
        <circle cx="160" cy="90" r="6" fill="var(--cr-gold)" opacity=".8" />
      </>
    ),
  },
  "layered-sky": {
    label: "Seven soft bands of colour layered above a horizon",
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--cr-sky)" />
        {Array.from({ length: 7 }, (_, i) => (
          <path
            key={i}
            className="cr-band"
            style={{ animationDelay: `${i * 0.4}s` }}
            d={`M0 ${150 - i * 18} Q160 ${120 - i * 22} 320 ${150 - i * 18}`}
            fill="none"
            stroke="var(--cr-gold)"
            strokeOpacity={0.25 + i * 0.08}
            strokeWidth="3"
          />
        ))}
        <rect x="0" y="152" width="320" height="28" fill="var(--cr-earth)" />
      </>
    ),
  },
  "water-and-land": {
    label: "Gentle waves meeting a shoreline under an open sky",
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--cr-sky)" />
        <path d="M0 120 Q80 100 150 118 L150 180 L0 180Z" fill="var(--cr-earth)" />
        <g className="cr-wave">
          <path d="M140 126 Q180 118 220 126 T300 126 T380 126 V180 H140Z" fill="var(--cr-water)" />
          <path d="M140 132 Q180 124 220 132 T300 132 T380 132" fill="none" stroke="var(--cr-water-hi)" strokeWidth="2" />
        </g>
      </>
    ),
  },
  "rain-and-growth": {
    label: "Light rain falling on soil and green shoots rising",
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--cr-sky)" />
        {Array.from({ length: 16 }, (_, i) => (
          <line key={i} className="cr-rain" x1={12 + i * 20} y1={-16} x2={9 + i * 20} y2={0} style={{ animationDelay: `${(i % 5) * 0.3}s` }} />
        ))}
        <rect x="0" y="150" width="320" height="30" fill="var(--cr-earth)" />
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} className="cr-shoot" style={{ animationDelay: `${1 + i * 0.35}s` }} d={`M${24 + i * 34} 150 q-6 -16 0 -30 q6 14 0 30`} fill="var(--cr-green)" />
        ))}
      </>
    ),
  },
  "calligraphic-strokes": {
    label: "Flowing abstract pen strokes drawn one after another (no words)",
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--cr-paper)" />
        {["M40 120 C80 40 140 160 180 80 S260 60 280 110", "M60 140 C110 110 170 150 230 120", "M90 70 C120 50 150 60 170 50"].map((d, i) => (
          <path key={i} className="cr-stroke" style={{ animationDelay: `${i * 1.2}s` }} d={d} fill="none" stroke="var(--cr-ink)" strokeWidth={6 - i * 1.5} strokeLinecap="round" />
        ))}
      </>
    ),
  },
};

export const CREATION_VISUAL_LABELS = Object.fromEntries(Object.entries(SCENES).map(([k, v]) => [k, v.label])) as Record<VisualKey, string>;

export function CreationVisual({
  animation,
  alt,
  caption,
  strings,
  decorative,
}: {
  animation: string;
  alt: string;
  caption?: string;
  strings: { play: string; pause: string; replay: string; note: string };
  /** A purely decorative scene: hidden from assistive technology, controls kept for motion. */
  decorative?: boolean;
}) {
  const scene = SCENES[animation as VisualKey];
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPlaying(!reduce);
  }, []);
  if (!scene) return null;
  return (
    <figure className="qa cr-visual" data-playing={playing ? "true" : "false"} data-visual={animation}>
      <svg key={run} viewBox="0 0 320 180" className="qa-svg" {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": alt })}>
        {decorative ? null : <title>{alt}</title>}
        {scene.render()}
      </svg>
      <figcaption>
        {caption ? <span>{caption}</span> : null}
        <span className="qa-controls">
          <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm cr-ctl" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
            {playing ? strings.pause : strings.play}
          </button>
          <button
            type="button"
            className="zq-btn zq-btn-quiet zq-btn-sm cr-ctl"
            onClick={() => {
              setRun((r) => r + 1);
              setPlaying(true);
            }}
          >
            {strings.replay}
          </button>
        </span>
        <span className="zq-meta qa-note">{strings.note}</span>
      </figcaption>
    </figure>
  );
}
