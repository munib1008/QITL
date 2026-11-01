"use client";

import { Suspense, use, useSyncExternalStore, type ReactNode } from "react";

/**
 * Defers the hydration of a server-rendered island until it is near the viewport or the reader touches it.
 *
 * The island's HTML is rendered on the server as usual (content, links and anchors work without any JavaScript, and
 * crawlers see everything). On the client, React keeps that HTML untouched while the boundary is suspended; the first
 * of {an IntersectionObserver reporting the target within `margin`, a pointer / key / focus event inside it, a hash
 * navigation to it} lets it hydrate. React replays the click or key press that woke it, so nothing is lost.
 * Before this, the home page hydrated all 29 journey stops during load (the largest block of main-thread script on the
 * page, docs/RESPONSIVE.md); now a reader who has not scrolled to them does not pay for them.
 *
 * Only the first load is deferred: on a client-side navigation the island renders immediately (`useSyncExternalStore`
 * reports `hydrating` only while React is hydrating server HTML).
 */
const noop = () => () => {};
const released = new Set<string>();
const pending = new Map<string, Promise<void>>();

function release(id: string) {
  released.add(id);
}

function wait(id: string, margin: string): Promise<void> | null {
  if (released.has(id)) return null;
  const known = pending.get(id);
  if (known) return known;
  const p = new Promise<void>((resolve) => {
    const done = () => {
      cleanup();
      release(id);
      pending.delete(id);
      resolve();
    };
    const target = document.getElementById(id);
    // No target or no IntersectionObserver: nothing to wait for, hydrate right away (the pre-change behaviour).
    if (!target || !("IntersectionObserver" in window)) {
      done();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) done();
      },
      { rootMargin: margin },
    );
    io.observe(target);
    const events = ["pointerdown", "touchstart", "keydown", "focusin"] as const;
    for (const ev of events) target.addEventListener(ev, done, { capture: true, passive: true, once: true });
    window.addEventListener("hashchange", done, { once: true });
    function cleanup() {
      io.disconnect();
      for (const ev of events) target!.removeEventListener(ev, done, { capture: true });
      window.removeEventListener("hashchange", done);
    }
  });
  pending.set(id, p);
  return p;
}

function Gate({ targetId, margin, children }: { targetId: string; margin: string; children: ReactNode }) {
  // true while React hydrates server HTML (the server snapshot), false for a client-side render.
  const hydrating = useSyncExternalStore(noop, () => false, () => true);
  if (hydrating && typeof window !== "undefined") {
    const p = wait(targetId, margin);
    if (p) use(p);
  }
  return <>{children}</>;
}

/** `targetId` is the id of an element that wraps this island in the server HTML. */
export function HydrateOnVisible({ targetId, margin = "100px 0px", children }: { targetId: string; margin?: string; children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Gate targetId={targetId} margin={margin}>
        {children}
      </Gate>
    </Suspense>
  );
}
