import type { SVGProps } from "react";
import type { EvidenceKind } from "@/content/journey";

/** Line icons on a 16px grid, 1.5px stroke, currentColor. Ported from design/reference/bundle.js. */
type P = SVGProps<SVGSVGElement>;
const Svg = ({ children, ...p }: P) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" {...p}>
    {children}
  </svg>
);

export const Icon = {
  bookmark: (p: P) => (
    <Svg {...p}>
      <path d="M4 2h8v12l-4-3-4 3z" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  ),
  bookmarked: (p: P) => (
    <Svg {...p}>
      <path d="M4 2h8v12l-4-3-4 3z" fill="currentColor" />
    </Svg>
  ),
  copy: (p: P) => (
    <Svg {...p}>
      <rect x={5} y={5} width={9} height={9} rx={1} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <path d="M11 5V2H2v9h3" fill="none" stroke="currentColor" strokeWidth={1.5} />
    </Svg>
  ),
  share: (p: P) => (
    <Svg {...p}>
      <path d="M8 2v8M4.5 5.5 8 2l3.5 3.5M3 9v5h10V9" fill="none" stroke="currentColor" strokeWidth={1.5} />
    </Svg>
  ),
  source: (p: P) => (
    <Svg {...p}>
      <path d="M3 2h7l3 3v9H3zM10 2v3h3M5.5 8h5M5.5 11h5" fill="none" stroke="currentColor" strokeWidth={1.4} />
    </Svg>
  ),
  discuss: (p: P) => (
    <Svg {...p}>
      <path d="M2 3h12v8H7l-3 3v-3H2z" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  ),
  search: (p: P) => (
    <Svg {...p}>
      <circle cx={7} cy={7} r={4.5} fill="none" stroke="currentColor" strokeWidth={1.6} />
      <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth={1.6} />
    </Svg>
  ),
  close: (p: P) => (
    <Svg {...p}>
      <path d="m3.5 3.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth={1.6} />
    </Svg>
  ),
  check: (p: P) => (
    <Svg {...p}>
      <path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" strokeWidth={1.8} />
    </Svg>
  ),
  alert: (p: P) => (
    <Svg {...p}>
      <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M8 6v4M8 11.8v.4" stroke="currentColor" strokeWidth={1.6} />
    </Svg>
  ),
  flag: (p: P) => (
    <Svg {...p}>
      <path d="M3 14V2m0 1h9l-2 3 2 3H3" fill="none" stroke="currentColor" strokeWidth={1.5} />
    </Svg>
  ),
  chevronUp: (p: P) => (
    <Svg {...p}>
      <path d="m4 10 4-4 4 4" fill="none" stroke="currentColor" strokeWidth={1.6} />
    </Svg>
  ),
  chevronDown: (p: P) => (
    <Svg {...p}>
      <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth={1.6} />
    </Svg>
  ),
};
export type IconName = keyof typeof Icon;

/** Eight-point star (khatam) built from two squares: the QITL geometric primitive. */
export function Star(p: P) {
  return (
    <Svg {...p}>
      <rect x={3} y={3} width={10} height={10} fill="currentColor" />
      <rect x={3} y={3} width={10} height={10} fill="currentColor" transform="rotate(45 8 8)" />
    </Svg>
  );
}

/** Evidence marks are reserved for EvidenceLabel; never reuse them as decoration. */
export function EvidenceMark({ kind, ...p }: P & { kind: EvidenceKind }) {
  switch (kind) {
    case "quran":
      return <Star {...p} />;
    case "hadith":
      return (
        <Svg {...p}>
          <circle cx={8} cy={8} r={5.5} fill="currentColor" />
        </Svg>
      );
    case "scholar":
      return (
        <Svg {...p}>
          <circle cx={8} cy={8} r={5.5} fill="none" stroke="currentColor" strokeWidth={1.6} />
          <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
        </Svg>
      );
    case "estimate":
      return (
        <Svg {...p}>
          <path d="M2 6c2-2 4 2 6 0s4 2 6 0M2 11c2-2 4 2 6 0s4 2 6 0" fill="none" stroke="currentColor" strokeWidth={1.6} />
        </Svg>
      );
    case "disputed":
      return (
        <Svg {...p}>
          <path d="M8 1.5 14.5 8 8 14.5z" fill="currentColor" />
          <path d="M7 2.9 1.5 8 7 13.1z" fill="none" stroke="currentColor" strokeWidth={1.4} />
        </Svg>
      );
    default:
      return (
        <Svg {...p}>
          <path
            d="M5.5 5.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4V10M8 12.2v.3"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      );
  }
}

/** Geometric rosette motif (8, 10 or 12 points). Never a figure. */
export function Rosette({ points = 8, className }: { points?: 8 | 10 | 12; className?: string }) {
  const R = 11;
  const r = R * (points >= 12 ? 0.72 : points >= 10 ? 0.66 : 0.58);
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const rr = i % 2 ? r : R;
    pts.push(`${(12 + rr * Math.cos(a)).toFixed(2)},${(12 + rr * Math.sin(a)).toFixed(2)}`);
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <polygon points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinejoin="round" />
      <circle cx={12} cy={12} r={r * 0.45} fill="none" stroke="currentColor" strokeWidth={0.9} />
    </svg>
  );
}
