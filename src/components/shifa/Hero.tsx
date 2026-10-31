"use client";

import { useEffect, useState } from "react";
import "@/styles/shifa.css";

/**
 * Abstract decoration for the Shifa hub: leaves, a vessel and flowing water in plain shapes. Never a person, a prophet or
 * anything unseen, and nothing frightening. Same contract as the other module illustrations: pause and replay, and it
 * does not autoplay under prefers-reduced-motion. No inline script; the motion is CSS only.
 */
export function ShifaHero({ labels }: { labels: { label: string; pause: string; play: string; replay: string; note: string } }) {
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPlaying(!reduce);
  }, []);
  return (
    <figure className="sh-hero" data-playing={playing ? "true" : "false"} data-testid="shifa-hero">
      <svg key={run} viewBox="0 0 320 140" role="img" aria-label={labels.label} className="sh-hero-svg">
        <title>{labels.label}</title>
        <rect width="320" height="140" rx="12" fill="var(--sh-sky)" />
        <g className="sh-ring" fill="none" stroke="var(--sh-line)" strokeWidth="1.5">
          <circle cx="160" cy="70" r="52" />
          <circle cx="160" cy="70" r="40" strokeDasharray="3 6" />
        </g>
        {[0, 1, 2, 3].map((i) => (
          <path key={i} className="sh-sway" style={{ animationDelay: `${i * 0.45}s` }} d={`M${46 + i * 22} 118 C${40 + i * 22} 88 ${52 + i * 22} 66 ${46 + i * 22} 44 C${64 + i * 22} 66 ${66 + i * 22} 96 ${46 + i * 22} 118z`} fill="var(--sh-leaf)" opacity={0.85 - i * 0.12} />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <path key={`r${i}`} className="sh-sway" style={{ animationDelay: `${i * 0.45 + 0.2}s` }} d={`M${274 - i * 22} 118 C${280 - i * 22} 88 ${268 - i * 22} 66 ${274 - i * 22} 44 C${256 - i * 22} 66 ${254 - i * 22} 96 ${274 - i * 22} 118z`} fill="var(--sh-leaf)" opacity={0.85 - i * 0.12} />
        ))}
        <path d="M138 52h44M144 52v14c-14 6-22 18-22 30a38 38 0 0076 0c0-12-8-24-22-30V52" fill="var(--sh-vessel)" stroke="var(--sh-line)" strokeWidth="2" strokeLinejoin="round" />
        <path className="sh-flow" d="M126 100c10-6 20 6 34 0s24-6 34 0" fill="none" stroke="var(--sh-water)" strokeWidth="4" strokeLinecap="round" />
        <path className="sh-flow sh-flow-2" d="M130 112c10-6 20 6 30 0s20-6 30 0" fill="none" stroke="var(--sh-water)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      </svg>
      <figcaption>
        <span className="zq-meta">{labels.note}</span>
        <span className="sh-hero-controls">
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
      </figcaption>
    </figure>
  );
}
