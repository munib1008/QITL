"use client";

import { useEffect, useState, type ReactNode } from "react";

const KEY = "qitl-creation-kids";

/**
 * Kids mode changes the presentation only: simpler headings, larger type and calmer visuals. The entries, their
 * evidence classes and their citations are the same in both modes.
 */
export function KidsMode({ label, onText, children }: { label: string; onText: string; children: ReactNode }) {
  const [kids, setKids] = useState(false);
  useEffect(() => {
    try {
      setKids(localStorage.getItem(KEY) === "1");
    } catch {
      // storage unavailable
    }
  }, []);
  const toggle = () => {
    setKids((k) => {
      try {
        localStorage.setItem(KEY, k ? "0" : "1");
      } catch {
        // ignore
      }
      return !k;
    });
  };
  return (
    <div className="cr" data-kids={kids ? "true" : "false"}>
      <div className="cr-kidsbar">
        <button type="button" className="zq-btn zq-btn-secondary cr-kidsbtn" aria-pressed={kids} onClick={toggle}>
          <span className="cr-switch" aria-hidden="true" />
          {label}
        </button>
        <p className="zq-meta cr-kidsnote" role="status">
          {kids ? onText : ""}
        </p>
      </div>
      {children}
    </div>
  );
}
