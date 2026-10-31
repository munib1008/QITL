"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type RefObject } from "react";
import "@/styles/explorers.css";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";

/** Pan/zoom state: content is drawn at `translate(x, y) scale(s)` inside the viewport (CSS pixels). */
export interface View {
  s: number;
  x: number;
  y: number;
}
export interface Size {
  w: number;
  h: number;
}

const MARGIN = 48; // how far content may be pulled past the viewport edge

export function clampView(v: View, vp: Size, content: Size, min: number, max: number): View {
  const s = Math.min(max, Math.max(min, v.s));
  const axis = (pos: number, vpLen: number, len: number) => {
    const lo = Math.min(MARGIN, vpLen - len - MARGIN);
    const hi = Math.max(MARGIN, vpLen - len - MARGIN);
    return Math.min(hi, Math.max(lo, pos));
  };
  return { s, x: axis(v.x, vp.w, content.w * s), y: axis(v.y, vp.h, content.h * s) };
}

/** Zoom by `f` keeping the viewport point (px, py) fixed. */
export function zoomAt(v: View, f: number, px: number, py: number, min: number, max: number): View {
  const s = Math.min(max, Math.max(min, v.s * f));
  const k = s / v.s;
  return { s, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
}

interface Options {
  content: Size;
  /** The starting (and reset) view for a viewport size. */
  initial: (vp: Size) => View;
  min?: number;
  max?: number;
  /** Server-render size, before the viewport is measured. */
  ssrViewport?: Size;
}

/**
 * Touch, mouse, wheel (pinch on trackpads arrives as ctrl+wheel) and keyboard pan/zoom for an SVG drawing.
 * One finger or mouse drag pans, two fingers pinch-zoom, plain wheel scrolls the page (no scroll hijacking).
 * A press that moved is not a click, so dragging across a place never opens it.
 */
export function usePanZoom({ content, initial, min = 0.5, max = 3, ssrViewport = { w: 360, h: 380 } }: Options) {
  const ref = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Size>(ssrViewport);
  const [view, setView] = useState<View>(() => clampView(initial(ssrViewport), ssrViewport, content, min, max));
  const vpRef = useRef(vp);
  const measured = useRef(false);
  const initialRef = useRef(initial);
  initialRef.current = initial;

  const set = useCallback((f: (v: View) => View) => setView((v) => clampView(f(v), vpRef.current, content, min, max)), [content, min, max]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const size = { w: Math.round(r.width), h: Math.round(r.height) };
      if (!size.w || !size.h) return;
      const first = !measured.current;
      measured.current = true;
      vpRef.current = size;
      setVp(size);
      if (first) setView(clampView(initialRef.current(size), size, content, min, max));
      else setView((v) => clampView(v, size, content, min, max));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    // Trackpad pinch and ctrl+wheel zoom the drawing; a plain wheel keeps scrolling the page.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      set((v) => zoomAt(v, Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top, min, max));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro?.disconnect();
      el.removeEventListener("wheel", onWheel);
    };
  }, [content, min, max, set]);

  /* ---------- pointers ---------- */
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef({ moved: false, sx: 0, sy: 0 });

  const local = (e: RPointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = local(e);
    pts.current.set(e.pointerId, p);
    if (pts.current.size === 1) drag.current = { moved: false, sx: p.x, sy: p.y };
  };
  const capture = (id: number) => {
    try {
      if (!ref.current?.hasPointerCapture(id)) ref.current?.setPointerCapture(id);
    } catch {
      /* pointer already released */
    }
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const prev = pts.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pts.current.set(e.pointerId, p);
    if (pts.current.size === 1) {
      if (!drag.current.moved && Math.hypot(p.x - drag.current.sx, p.y - drag.current.sy) > 6) {
        drag.current.moved = true;
        capture(e.pointerId);
      }
      if (drag.current.moved) set((v) => ({ ...v, x: v.x + p.x - prev.x, y: v.y + p.y - prev.y }));
    } else if (pts.current.size === 2) {
      drag.current.moved = true;
      for (const id of pts.current.keys()) capture(id);
      const other = [...pts.current.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y) || 1;
      const d1 = Math.hypot(p.x - other.x, p.y - other.y) || 1;
      const m0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
      const m1 = { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 };
      set((v) => {
        const z = zoomAt(v, d1 / d0, m0.x, m0.y, min, max);
        return { ...z, x: z.x + m1.x - m0.x, y: z.y + m1.y - m0.y };
      });
    }
  };
  const onPointerEnd = (e: RPointerEvent<HTMLDivElement>) => {
    pts.current.delete(e.pointerId);
  };
  /** Swallow the click that ends a drag or pinch. */
  const onClickCapture = (e: RMouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  const zoomBy = useCallback((f: number) => set((v) => zoomAt(v, f, vpRef.current.w / 2, vpRef.current.h / 2, min, max)), [set, min, max]);
  const reset = useCallback(() => setView(clampView(initialRef.current(vpRef.current), vpRef.current, content, min, max)), [content, min, max]);
  /** Pan so the content point (cx, cy) sits in the middle of the viewport. */
  const centerOn = useCallback((cx: number, cy: number) => set((v) => ({ ...v, x: vpRef.current.w / 2 - cx * v.s, y: vpRef.current.h / 2 - cy * v.s })), [set]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const step = 48;
    const k: Record<string, () => void> = {
      ArrowLeft: () => set((v) => ({ ...v, x: v.x + step })),
      ArrowRight: () => set((v) => ({ ...v, x: v.x - step })),
      ArrowUp: () => set((v) => ({ ...v, y: v.y + step })),
      ArrowDown: () => set((v) => ({ ...v, y: v.y - step })),
      "+": () => zoomBy(1.25),
      "=": () => zoomBy(1.25),
      "-": () => zoomBy(0.8),
      "0": reset,
    };
    const fn = k[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  return {
    ref: ref as RefObject<HTMLDivElement>,
    view,
    viewport: vp,
    zoomBy,
    reset,
    centerOn,
    transform: `translate(${view.x.toFixed(1)} ${view.y.toFixed(1)}) scale(${view.s.toFixed(3)})`,
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onClickCapture, onKeyDown },
    min,
    max,
  };
}

/** On-screen zoom buttons (44px) with a polite announcement of the zoom level. */
export function ZoomControls({ label, view, min, max, onIn, onOut, onReset }: { label: string; view: View; min: number; max: number; onIn: () => void; onOut: () => void; onReset: () => void }) {
  const t = uiStrings(useLocale()).zoom;
  return (
    <div className="zx-zoom" role="group" aria-label={label}>
      <button type="button" className="zx-zbtn" onClick={onIn} disabled={view.s >= max - 1e-3} aria-label={t.in}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button type="button" className="zx-zbtn" onClick={onOut} disabled={view.s <= min + 1e-3} aria-label={t.out}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <button type="button" className="zx-zbtn" onClick={onReset} aria-label={t.reset}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" />
        </svg>
      </button>
      <span className="sr-only" aria-live="polite">
        {t.level} {Math.round(view.s * 100)}%
      </span>
    </div>
  );
}
