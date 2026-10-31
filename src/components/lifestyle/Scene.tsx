"use client";

import { useEffect, useState, type ReactNode } from "react";
import { lifestyle } from "@/lib/i18n/modules/lifestyle";

/**
 * Non-figurative illustrations for Life Through the Ages: land, plants, water, buildings, tools and boats.
 * Never a person, a prophet, an animal rider, an angel or anything unseen, and nothing is claimed as anyone's
 * possession. They illustrate a kind of setting, not a specific place, time or record. Same contract as
 * components/story/AnimationPlayer: pause and replay, and no autoplay under prefers-reduced-motion.
 */
const SCENES: Record<string, { render: () => ReactNode }> = {
  fields: {
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sky)" />
        <rect y="110" width="320" height="70" fill="var(--qa-field)" />
        {Array.from({ length: 6 }, (_, i) => (
          <path key={i} className="lta-sway" style={{ animationDelay: `${i * 0.2}s` }} d={`M0 ${120 + i * 10} Q160 ${114 + i * 10} 320 ${120 + i * 10}`} stroke="var(--qa-stem)" strokeWidth="3" fill="none" />
        ))}
        <path d="M0 176 H320" stroke="var(--qa-water-hi)" strokeWidth="4" />
      </>
    ),
  },
  palms: {
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sky)" />
        <rect y="140" width="320" height="40" fill="var(--qa-sand)" />
        {[60, 150, 250].map((x, i) => (
          <g key={x} className="lta-sway" style={{ animationDelay: `${i * 0.4}s`, transformOrigin: `${x}px 140px` }}>
            <path d={`M${x} 140 Q${x + 4} 100 ${x} 62`} stroke="var(--qa-wood)" strokeWidth="5" fill="none" />
            {[-60, -25, 10, 45, 80].map((a) => (
              <path key={a} d={`M${x} 62 q${Math.cos((a * Math.PI) / 180) * 30} ${Math.sin((a * Math.PI) / 180) * 12 - 6} ${Math.cos((a * Math.PI) / 180) * 40} ${Math.sin((a * Math.PI) / 180) * 20 + 10}`} stroke="var(--qa-stem)" strokeWidth="4" fill="none" />
            ))}
          </g>
        ))}
      </>
    ),
  },
  harvest: {
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sky)" />
        <rect y="130" width="320" height="50" fill="var(--qa-soil)" />
        {Array.from({ length: 5 }, (_, i) => (
          <g key={i} className="lta-rise" style={{ animationDelay: `${i * 0.35}s` }} transform={`translate(${40 + i * 60} 130)`}>
            <path d="M-14 0 L0 -46 L14 0 Z" fill="var(--qa-grain)" />
            <line x1="-10" y1="-18" x2="10" y2="-18" stroke="var(--qa-wood)" strokeWidth="3" />
          </g>
        ))}
      </>
    ),
  },
  well: {
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sky)" />
        <rect y="140" width="320" height="40" fill="var(--qa-sand)" />
        <rect x="120" y="100" width="80" height="40" rx="4" fill="var(--qa-stone)" stroke="var(--qa-stone-hi)" />
        <line x1="126" y1="100" x2="126" y2="50" stroke="var(--qa-wood)" strokeWidth="5" />
        <line x1="194" y1="100" x2="194" y2="50" stroke="var(--qa-wood)" strokeWidth="5" />
        <line x1="120" y1="50" x2="200" y2="50" stroke="var(--qa-wood)" strokeWidth="5" />
        <g className="lta-bucket">
          <line x1="160" y1="50" x2="160" y2="84" stroke="var(--qa-wood-hi)" strokeWidth="2" />
          <rect x="152" y="84" width="16" height="12" fill="var(--qa-wood)" />
        </g>
      </>
    ),
  },
  pastoral: {
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sky)" />
        <path d="M0 120 Q80 90 160 115 T320 105 V180 H0Z" fill="var(--qa-field)" />
        <path className="lta-flow" d="M0 160 Q80 150 160 160 T320 155" stroke="var(--qa-water-hi)" strokeWidth="6" fill="none" strokeDasharray="14 10" />
      </>
    ),
  },
  "trade-route": {
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sand)" />
        <rect x="20" y="70" width="50" height="40" fill="var(--qa-stone)" />
        <rect x="250" y="80" width="50" height="40" fill="var(--qa-stone)" />
        <path className="lta-flow" d="M70 95 Q160 40 250 100" stroke="var(--qa-wood)" strokeWidth="3" fill="none" strokeDasharray="8 6" />
      </>
    ),
  },
  "mud-brick": {
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sky)" />
        <rect y="150" width="320" height="30" fill="var(--qa-sand)" />
        {[30, 110, 200].map((x, i) => (
          <g key={x} className="lta-rise" style={{ animationDelay: `${i * 0.4}s` }}>
            <rect x={x} y={90 - i * 6} width="70" height={60 + i * 6} fill="var(--qa-soil)" />
            <rect x={x + 28} y={124} width="14" height="26" fill="var(--qa-cave)" />
            <rect x={x - 4} y={86 - i * 6} width="78" height="6" fill="var(--qa-wood)" />
          </g>
        ))}
      </>
    ),
  },
  "empty-market": {
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sky)" />
        <rect y="140" width="320" height="40" fill="var(--qa-sand-hi)" />
        {Array.from({ length: 4 }, (_, i) => (
          <g key={i} className="lta-rise" style={{ animationDelay: `${i * 0.3}s` }}>
            <path d={`M${20 + i * 76} 90 h64 l-8 16 h-48 z`} fill={i % 2 ? "var(--qa-gold)" : "var(--qa-water-hi)"} />
            <rect x={28 + i * 76} y="106" width="48" height="34" fill="var(--qa-wood-hi)" />
          </g>
        ))}
      </>
    ),
  },
  tools: {
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sand)" />
        <g className="lta-rise">
          <line x1="40" y1="40" x2="80" y2="150" stroke="var(--qa-wood)" strokeWidth="6" />
          <path d="M70 140 l24 -4 l-6 16 z" fill="var(--qa-stone-hi)" />
        </g>
        <path className="lta-rise" style={{ animationDelay: ".3s" }} d="M120 60 q40 0 40 40" stroke="var(--qa-stone-hi)" strokeWidth="5" fill="none" />
        <path className="lta-rise" style={{ animationDelay: ".6s" }} d="M190 150 q-14 -40 10 -70 h20 q24 30 10 70 z" fill="var(--qa-soil)" />
        <ellipse className="lta-rise" style={{ animationDelay: ".9s" }} cx="275" cy="140" rx="30" ry="12" fill="var(--qa-stone)" />
      </>
    ),
  },
  ship: {
    render: () => (
      <>
        <rect width="320" height="180" fill="var(--qa-sky)" />
        <rect y="130" width="320" height="50" fill="var(--qa-water)" />
        <g className="lta-bob">
          <path d="M110 128 H220 L204 146 H126 Z" fill="var(--qa-wood)" />
          <line x1="165" y1="128" x2="165" y2="60" stroke="var(--qa-wood-hi)" strokeWidth="4" />
          <path d="M168 64 L210 120 H168 Z" fill="var(--qa-sand-hi)" />
        </g>
      </>
    ),
  },
};

export const SCENE_KEYS = Object.keys(SCENES);

export function Scene({ scene, caption, labels }: { scene: string; caption?: string; labels: { note: string; play: string; pause: string; replay: string; scenes?: Record<string, string> } }) {
  const found = SCENES[scene];
  // Scene descriptions (alt text and caption) live in the interface strings (modules/lifestyle.ts, illustration.scenes).
  const s = found ? { ...found, label: labels.scenes?.[scene] ?? lifestyle.en.illustration.scenes[scene] ?? scene } : undefined;
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPlaying(!reduce);
  }, []);
  if (!s) return null;
  return (
    <figure className="qa lta-scene" data-playing={playing ? "true" : "false"} data-scene={scene}>
      <svg key={run} viewBox="0 0 320 180" role="img" aria-label={s.label} className="qa-svg">
        <title>{s.label}</title>
        {s.render()}
      </svg>
      <figcaption>
        <span>{caption ?? s.label}</span>
        <span className="qa-controls">
          <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
            {playing ? labels.pause : labels.play}
          </button>
          <button
            type="button"
            className="zq-btn zq-btn-quiet zq-btn-sm"
            onClick={() => {
              setRun((r) => r + 1);
              setPlaying(true);
            }}
          >
            {labels.replay}
          </button>
        </span>
        <span className="zq-meta qa-note">{labels.note}</span>
      </figcaption>
    </figure>
  );
}
