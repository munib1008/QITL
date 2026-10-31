"use client";

import { useEffect } from "react";

export const FLASH_MS = 3000;

/** "#ayah-30" or "#ayah-30-39" → {from, to}; anything else → null. */
export function parseAyahHash(hash: string): { from: number; to: number } | null {
  const m = /^#ayah-(\d{1,3})(?:-(\d{1,3}))?$/.exec(hash);
  if (!m) return null;
  const from = Number(m[1]);
  const to = m[2] ? Number(m[2]) : from;
  return from >= 1 && to >= from ? { from, to } : null;
}

/**
 * When the page is opened from a Quran reference (or a reference on this page is clicked), bring the referenced ayah
 * into view and mark it, and every ayah of a range, with a glowing border for three seconds. Clicking the same
 * reference again replays it. Reduced motion: no smooth scroll and no animation, the border still shows for 3 s.
 */
export function useAyahHighlight() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lit: HTMLElement[] = [];

    const clear = () => {
      for (const el of lit) el.classList.remove("qr-flash");
      lit = [];
    };

    const run = () => {
      const r = parseAyahHash(window.location.hash);
      if (!r) return;
      const els: HTMLElement[] = [];
      for (let a = r.from; a <= r.to; a++) {
        const el = document.getElementById(`ayah-${a}`);
        if (el) els.push(el);
      }
      if (!els.length) return;
      clear();
      if (timer) clearTimeout(timer);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      els[0]!.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      // Restart the animation even when the same ayah is lit twice in a row.
      for (const el of els) void el.offsetWidth;
      for (const el of els) el.classList.add("qr-flash");
      lit = els;
      timer = setTimeout(clear, FLASH_MS);
    };

    // A click on a reference to the hash we are already on fires no hashchange: replay it from the click.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href*='#ayah-']") as HTMLAnchorElement | null;
      if (!a) return;
      const url = new URL(a.href, window.location.href);
      if (url.pathname === window.location.pathname && url.hash === window.location.hash) setTimeout(run, 0);
    };

    // On open, wait a frame so a reader that mounts the target's controls first has laid them out.
    const raf = requestAnimationFrame(run);
    window.addEventListener("hashchange", run);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", run);
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      clear();
    };
  }, []);
}
