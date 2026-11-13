"use client";

import type { ReactNode } from "react";

/** Every control that opens the command palette goes through this event, so the palette is mounted once (locale layout). */
export const OPEN_SEARCH_EVENT = "qitl:open-search";
export const openSearch = () => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));

export function SearchTrigger({ className, label, children }: { className?: string; label: string; children: ReactNode }) {
  return (
    <button type="button" className={className} aria-label={label} aria-haspopup="dialog" onClick={openSearch}>
      {children}
    </button>
  );
}
