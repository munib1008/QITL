"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/** Reading depth tabs (ARIA tab pattern: arrows follow the reading direction, Home and End). */
export function DepthTabs({ tabs }: { tabs: Array<{ id: string; label: string; content: ReactNode }> }) {
  const [sel, setSel] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = tabs.length;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let next = sel;
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (sel + 1) % n;
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (sel - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    setSel(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="qp-depth">
      <div className="zq-tabs qp-tabs" role="tablist" aria-label="Reading depth" onKeyDown={onKey}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`depth-tab-${t.id}`}
            aria-controls={`depth-panel-${t.id}`}
            aria-selected={sel === i}
            tabIndex={sel === i ? 0 : -1}
            className="zq-tab"
            onClick={() => setSel(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} role="tabpanel" id={`depth-panel-${t.id}`} aria-labelledby={`depth-tab-${t.id}`} hidden={sel !== i} tabIndex={0} className="qp-panel">
          {t.content}
        </div>
      ))}
    </div>
  );
}
