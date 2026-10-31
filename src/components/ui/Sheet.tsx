"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import "@/styles/explorers.css";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";

/**
 * A modal panel: a draggable, expandable bottom sheet on phones and tablets, a side panel on desktop.
 * Native <dialog> (focus moves in, the page behind is inert, Esc closes); focus returns to `opener` on close.
 * Drag the grip up to expand, down to shrink or close; the grip is also a button for keyboard and screen readers.
 */
export function Sheet({ open, title, onClose, opener, children }: { open: boolean; title: ReactNode; onClose: () => void; opener?: Element | null; children: ReactNode }) {
  const t = uiStrings(useLocale()).sheet;
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [full, setFull] = useState(false);
  const [dy, setDy] = useState(0);
  const g = useRef<{ y: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openerRef = useRef(opener);
  openerRef.current = opener;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setFull(false);
      setDy(0);
      d.showModal();
      d.querySelector<HTMLElement>("[data-sheet-title]")?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClosed = () => {
      onCloseRef.current();
      const el = openerRef.current as HTMLElement | SVGElement | null | undefined;
      if (el && "focus" in el) el.focus();
    };
    d.addEventListener("close", onClosed);
    return () => d.removeEventListener("close", onClosed);
  }, []);

  const down = (e: RPointerEvent<HTMLButtonElement>) => {
    g.current = { y: e.clientY, moved: false, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!g.current || g.current.id !== e.pointerId) return;
    const d = e.clientY - g.current.y;
    if (Math.abs(d) > 6) g.current.moved = true;
    if (g.current.moved) setDy(d);
  };
  const up = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!g.current || g.current.id !== e.pointerId) return;
    const d = e.clientY - g.current.y;
    if (g.current.moved) {
      suppressClick.current = true;
      if (d < -60) setFull(true);
      else if (d > 90) {
        if (full) setFull(false);
        else ref.current?.close();
      }
    }
    g.current = null;
    setDy(0);
  };

  return (
    <dialog
      ref={ref}
      className={`zx-sheet${full ? " zx-sheet-full" : ""}`}
      aria-labelledby={`${id}-t`}
      data-size={full ? "full" : "half"}
      style={dy ? { transform: `translateY(${Math.max(-120, dy)}px)`, transition: "none" } : undefined}
      onClick={(e) => {
        // A click on the dimmed backdrop (the dialog box itself, outside its content) closes the panel.
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="zx-sheet-in">
        <div className="zx-sheet-bar">
          <button
            type="button"
            className="zx-grip"
            aria-expanded={full}
            aria-label={full ? t.shrink : t.expand}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              setFull((f) => !f);
            }}
          >
            <span aria-hidden="true" />
          </button>
          <div className="zx-sheet-head">
            <h2 id={`${id}-t`} tabIndex={-1} data-sheet-title>
              {title}
            </h2>
            <button type="button" className="zq-btn zq-btn-secondary zx-close" onClick={() => ref.current?.close()}>
              {t.close}
            </button>
          </div>
        </div>
        <div className="zx-sheet-body">{open ? children : null}</div>
      </div>
    </dialog>
  );
}
