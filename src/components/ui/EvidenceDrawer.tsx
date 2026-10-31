"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { EvidenceKind } from "@/content/journey";
import { EvidenceLabel } from "./evidence";
import { Icon } from "./icons";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";

export interface EvidenceTab {
  label: string;
  count?: number;
  content: ReactNode;
}

export interface EvidenceDrawerProps {
  claim: string;
  status?: EvidenceKind;
  tabs: EvidenceTab[];
  footer?: ReactNode;
  onClose: () => void;
  /** Theme of the scrim and panel; the journey uses its own glass theme. */
  theme?: "journey" | "light" | "dark";
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * The source panel. A modal dialog: side drawer from 768px, bottom sheet below.
 * Focus moves to Close on open, is trapped inside, Esc closes, and focus returns to the trigger.
 * Tabs follow the ARIA tab pattern (arrow keys, Home, End). Empty tabs say so; they are never hidden.
 */
export function EvidenceDrawer({ claim, status, tabs, footer, onClose, theme }: EvidenceDrawerProps) {
  const u = uiStrings(useLocale()).drawer;
  const [sel, setSel] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const trigger = useRef<Element | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();
  const [mounted, setMounted] = useState(false);

  const close = useCallback(() => {
    onClose();
    const t = trigger.current as HTMLElement | null;
    if (t && typeof t.focus === "function") requestAnimationFrame(() => t.focus());
  }, [onClose]);

  useEffect(() => {
    trigger.current = document.activeElement;
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const f = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mounted, close]);

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = tabs.length;
    let next = sel;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (sel + 1) % n;
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (sel - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    setSel(next);
    tabRefs.current[next]?.focus();
  };

  if (!mounted) return null;
  return createPortal(
    <div
      className="zq-jt-modal"
      data-theme={theme}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panel}
        className="zq-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-claim`}
      >
        <div className="zq-drawer-head">
          <div>
            <p className="zq-eyebrow" id={`${id}-title`}>
              {u.title}
            </p>
            <p className="zq-drawer-claim" id={`${id}-claim`}>
              {claim}
            </p>
            {status ? (
              <div style={{ marginTop: 8 }}>
                <EvidenceLabel kind={status} />
              </div>
            ) : null}
          </div>
          <button ref={closeBtn} type="button" className="zq-iconbtn" aria-label={u.close} onClick={close}>
            <Icon.close />
          </button>
        </div>
        <div className="zq-tabs" role="tablist" aria-label={u.tabs} onKeyDown={onTabKey}>
          {tabs.map((t, i) => (
            <button
              key={t.label}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-controls={`${id}-panel`}
              aria-selected={sel === i}
              tabIndex={sel === i ? 0 : -1}
              className="zq-tab"
              onClick={() => setSel(i)}
            >
              {t.label}
              {t.count != null ? ` (${t.count})` : ""}
            </button>
          ))}
        </div>
        <div className="zq-drawer-body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${sel}`} tabIndex={0}>
          {tabs[sel]?.content}
        </div>
        <div className="zq-drawer-foot">{footer ?? u.footer}</div>
      </div>
    </div>,
    document.body,
  );
}
