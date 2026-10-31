"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Long editorial forms on phones and tablets: a "Full-screen editing" button lifts the form into a full-screen view
 * (above the bottom bar, page scroll locked) with its own Done button; Esc also leaves it. On desktop the button is
 * hidden and the form stays in the page. It only changes layout: the form, its fields and every approval step are
 * the same component either way.
 */
export function FullScreenEditor({ title, children }: { title: string; children: ReactNode }) {
  const [full, setFull] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const enter = useRef<HTMLButtonElement>(null);
  const wasFull = useRef(false);

  useEffect(() => {
    if (full) {
      wasFull.current = true;
      document.documentElement.classList.add("zq-noscroll");
      box.current?.querySelector<HTMLElement>("[data-fs-title]")?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setFull(false);
      };
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("keydown", onKey);
        document.documentElement.classList.remove("zq-noscroll");
      };
    }
    if (wasFull.current) enter.current?.focus();
  }, [full]);

  return (
    <div ref={box} className={full ? "zq-fs zq-fs-on" : "zq-fs"} role={full ? "region" : undefined} aria-label={full ? `${title}, full-screen editing` : undefined}>
      <div className="zq-fs-bar">
        {full ? (
          <>
            <h2 tabIndex={-1} data-fs-title>
              {title}
            </h2>
            <button type="button" className="zq-btn zq-btn-primary" onClick={() => setFull(false)}>
              Done
            </button>
          </>
        ) : (
          <button ref={enter} type="button" className="zq-btn zq-btn-secondary zq-fs-enter" onClick={() => setFull(true)}>
            Full-screen editing
          </button>
        )}
      </div>
      <div className="zq-fs-body">{children}</div>
    </div>
  );
}
