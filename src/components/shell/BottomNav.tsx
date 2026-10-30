"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { resolveLocale, stripLocale } from "@/lib/i18n";
import { LangToggle, type LangLabels } from "./toggles";
import { useSession } from "@/components/account/useSession";

export interface BottomNavLabels {
  home: string;
  timeline: string;
  quran: string;
  explore: string;
  profile: string;
  close: string;
  exploreTitle: string;
  soon: string;
}

export interface ExploreItem {
  href: string | null; // null = not built yet, shown as coming soon (never a dead link)
  label: string;
  note?: string;
}

const I = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const ICONS = {
  home: (
    <I>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </I>
  ),
  timeline: (
    <I>
      <path d="M7 3v18" />
      <circle cx="7" cy="7" r="2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M11 7h9M11 17h6" />
    </I>
  ),
  quran: (
    <I>
      <path d="M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5z" />
      <path d="M12 6v14" />
    </I>
  ),
  explore: (
    <I>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </I>
  ),
  profile: (
    <I>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" />
    </I>
  ),
};

/**
 * Mobile and tablet navigation (below 1024px): five destinations with visible labels, fixed to the bottom and padded
 * for the device's safe area. The page reserves the same height (body padding in pages.css) so nothing is hidden.
 * Explore opens a bottom sheet (a modal dialog: focus moves in, Esc and the backdrop close it, focus returns).
 */
export function BottomNav({ labels, explore, locale, langLabels }: { labels: BottomNavLabels; explore: ExploreItem[]; locale?: string; langLabels?: LangLabels }) {
  const path = stripLocale(usePathname() ?? "/");
  const session = useSession();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && sheet.current) {
        const f = Array.from(sheet.current.querySelectorAll<HTMLElement>("a, button"));
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    btn.current?.focus();
  }

  const profileHref = session.status === "signed_in" ? "/account" : `/sign-in?returnTo=${encodeURIComponent(path)}`;
  const is = (p: string) => (p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`));
  const exploreActive = !open && explore.some((e) => e.href && is(e.href));
  const items = [
    { key: "home", href: "/", label: labels.home, active: is("/") },
    { key: "timeline", href: "/timeline", label: labels.timeline, active: is("/timeline") },
    { key: "quran", href: "/quran", label: labels.quran, active: is("/quran") },
  ] as const;

  return (
    <>
      <nav className="qb-nav" data-bottom-nav aria-label="Primary">
        {items.map((it) => (
          <Link key={it.key} href={it.href} className="qb-item" aria-current={it.active ? "page" : undefined}>
            {ICONS[it.key]}
            <span>{it.label}</span>
          </Link>
        ))}
        <button ref={btn} type="button" className="qb-item" aria-haspopup="dialog" aria-expanded={open} data-active={exploreActive || open || undefined} onClick={() => setOpen(true)}>
          {ICONS.explore}
          <span>{labels.explore}</span>
        </button>
        <Link href={profileHref} className="qb-item" aria-current={is("/account") || is("/sign-in") ? "page" : undefined}>
          {ICONS.profile}
          <span>{labels.profile}</span>
        </Link>
      </nav>
      {open ? (
        <div className="qb-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
          <div ref={sheet} className="qb-sheet" role="dialog" aria-modal="true" aria-labelledby="qb-sheet-h">
            <div className="qb-grip" aria-hidden="true" />
            <div className="qb-sheet-head">
              <h2 id="qb-sheet-h">{labels.exploreTitle}</h2>
              <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={close}>
                {labels.close}
              </button>
            </div>
            <ul className="qb-grid">
              {explore.map((e) => (
                <li key={e.label}>
                  {e.href ? (
                    <Link href={e.href} aria-current={is(e.href) ? "page" : undefined} onClick={() => setOpen(false)}>
                      <b>{e.label}</b>
                      {e.note ? <small>{e.note}</small> : null}
                    </Link>
                  ) : (
                    <span className="qb-soon" aria-disabled="true">
                      <b>{e.label}</b>
                      <small>{labels.soon}</small>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {langLabels ? (
              <div className="qb-lang">
                <LangToggle locale={resolveLocale(locale)} labels={langLabels} variant="sheet" />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
