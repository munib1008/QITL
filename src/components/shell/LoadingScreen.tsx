import { Mark } from "@/components/shell/Logo";

/** Shown while a page streams in: the emblem, gently pulsing (static under reduced motion). */
export function LoadingScreen() {
  return (
    <div className="qitl-loading" role="status" aria-live="polite">
      <Mark size={72} label="QITL" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
