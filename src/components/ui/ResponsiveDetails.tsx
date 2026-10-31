"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A native disclosure that starts collapsed on phones and tablets and open on desktop (min-width 1024px).
 * Without JavaScript it stays a working <details>.
 */
export function ResponsiveDetails({ summary, className, children, openFrom = 1024 }: { summary: ReactNode; className?: string; children: ReactNode; openFrom?: number }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current && window.matchMedia(`(min-width: ${openFrom}px)`).matches) ref.current.open = true;
  }, [openFrom]);
  return (
    <details ref={ref} className={className}>
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
