"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";

/**
 * Progressive layer over the server-rendered timeline list (which stays complete and usable without it):
 * a sticky bar with reading progress, the chapter (era) in view and a jump-to-era menu; the stop nearest the middle
 * of the screen is highlighted; stops fade in as they arrive. No scroll hijacking: native scrolling only.
 * Reduced motion, Save-Data and low-core devices get no reveal animation.
 */
export function TimelineEnhancer({ eras, children }: { eras: Array<{ title: string; id: string }>; children: ReactNode }) {
  const t = uiStrings(useLocale()).timeline;
  const root = useRef<HTMLDivElement>(null);
  const [era, setEra] = useState(eras[0]?.title ?? "");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const stops = Array.from(el.querySelectorAll<HTMLElement>("[data-stop]"));
    const eraEls = Array.from(el.querySelectorAll<HTMLElement>("[data-era]"));

    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; hardwareConcurrency?: number };
    const lite = window.matchMedia("(prefers-reduced-motion: reduce)").matches || nav.connection?.saveData === true || (nav.hardwareConcurrency ?? 8) <= 2;
    if (!lite) {
      const vh = window.innerHeight;
      for (const s of stops) if (s.getBoundingClientRect().top > vh) s.classList.add("zq-vt-rv");
    }

    // The stop crossing the middle band of the screen is the active one; its era is the current chapter.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.remove("zq-vt-rv");
            for (const s of stops) s.removeAttribute("data-active");
            e.target.setAttribute("data-active", "");
            const t = e.target.closest<HTMLElement>("[data-era]")?.dataset.era;
            if (t) setEra(t);
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const s of stops) io.observe(s);
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) {
          e.target.classList.remove("zq-vt-rv");
          reveal.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const s of stops) if (s.classList.contains("zq-vt-rv")) reveal.observe(s);

    // A stop opened from a link (?selected=) is brought into view below the sticky bars.
    const opened = el.querySelector<HTMLElement>("details[open]");
    if (opened && new URLSearchParams(location.search).has("selected")) {
      opened.closest<HTMLElement>("[data-stop]")?.classList.remove("zq-vt-rv");
      opened.scrollIntoView({ block: "start" });
    }

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight * 0.5;
        const p = total > 0 ? Math.min(1, Math.max(0, (window.innerHeight * 0.5 - r.top) / total)) : 0;
        setProgress(p);
        if (r.top > window.innerHeight * 0.4 && eraEls[0]?.dataset.era) setEra(eraEls[0].dataset.era);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      reveal.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div ref={root} className="zq-vt-wrap" style={{ ["--vt-progress" as string]: progress }}>
      <div className="zq-vt-bar-sticky">
        <div className="zq-vt-now-reading" aria-live="polite">
          <span className="zq-eyebrow">{t.nowReading}</span>
          <b>{era}</b>
        </div>
        <label className="zq-vt-jump">
          <span className="sr-only">{t.jump}</span>
          <select
            value={eras.find((e) => e.title === era)?.id ?? ""}
            onChange={(e) => {
              const t = document.getElementById(e.target.value);
              if (!t) return;
              const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              t.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
              t.querySelector<HTMLElement>("summary, a")?.focus({ preventScroll: true });
            }}
          >
            {eras.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        <div className="zq-vt-progress" role="progressbar" aria-label={t.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span />
        </div>
      </div>
      {children}
    </div>
  );
}
