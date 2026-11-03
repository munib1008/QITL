"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Runs `fn` once per animation frame while the page scrolls or resizes, and once after mount. */
function useFrameOnScroll(fn: () => void, deps: unknown[]) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let raf = 0;
    const run = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        ref.current();
      });
    };
    window.addEventListener("scroll", run, { passive: true });
    window.addEventListener("resize", run);
    const t = window.setTimeout(() => ref.current(), 60);
    return () => {
      window.removeEventListener("scroll", run);
      window.removeEventListener("resize", run);
      window.clearTimeout(t);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measure when the caller's layout inputs change
  }, deps);
}

export interface SectionSpy {
  active: string | null;
  /** 0..1 through the active section, rounded to 1/25 so a scroll does not re-render on every pixel. */
  p: number;
  /** Sections that have scrolled into the lower part of the viewport (for reveal-once motion). */
  reached: Record<string, true>;
  measured: boolean;
}

/**
 * Era scroll: finds the section (an element with `data-spy="<key>"`) that holds the reading line (40% down the
 * viewport), how far through it the reader is, and which sections have been reached. State changes only when one of
 * those changes. Before the first measurement `measured` is false: callers show everything (no JS = nothing hidden).
 */
export function useSectionSpy(attr: string, deps: unknown[] = []): SectionSpy {
  const [spy, setSpy] = useState<SectionSpy>({ active: null, p: 0, reached: {}, measured: false });
  const measure = useCallback(() => {
    const vh = window.innerHeight || 800;
    const line = vh * 0.4;
    const heads = Array.from(document.querySelectorAll<HTMLElement>(`[data-spy][data-spy-group="${attr}"]`));
    const tops = heads.map((h) => ({ k: h.dataset.spy as string, top: h.getBoundingClientRect().top }));
    const reached: Record<string, true> = {};
    for (const t of tops) if (t.top < vh * 0.9) reached[t.k] = true;
    let active: string | null = tops[0]?.k ?? null;
    let p = 0;
    tops.forEach((t, i) => {
      if (t.top <= line) {
        active = t.k;
        const next = tops[i + 1] ? tops[i + 1]!.top : t.top + 1400;
        p = Math.max(0, Math.min(1, (line - t.top) / Math.max(1, next - t.top)));
      }
    });
    p = Math.round(p * 25) / 25;
    setSpy((prev) =>
      prev.measured && prev.active === active && prev.p === p && Object.keys(prev.reached).join() === Object.keys(reached).join() ? prev : { active, p, reached, measured: true },
    );
  }, [attr]);
  useFrameOnScroll(measure, deps);
  return spy;
}

/** Lineage scroll: the node (an element with `data-node="<id>"`) nearest the reading line (45% down the viewport). */
export function useNearestSpy(deps: unknown[] = []): string | null {
  const [id, setId] = useState<string | null>(null);
  const measure = useCallback(() => {
    const vh = window.innerHeight || 800;
    const line = vh * 0.45;
    let best: string | null = null;
    let bd = Infinity;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-node]"))) {
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - line);
      if (d < bd) {
        bd = d;
        best = el.dataset.node ?? null;
      }
    }
    setId((prev) => (prev === best ? prev : best));
  }, []);
  useFrameOnScroll(measure, deps);
  return id;
}
