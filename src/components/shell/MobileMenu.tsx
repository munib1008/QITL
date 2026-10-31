"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NavLink } from "./SiteHeader";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";

/** Below 1024px the section links fold into a disclosure menu. Esc closes and returns focus to the button. */
export function MobileMenu({ links, label }: { links: NavLink[]; label: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const t = uiStrings(useLocale()).shell;
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="zq-mmenu">
      <button ref={btn} type="button" className="zq-btn zq-btn-quiet zq-btn-sm" aria-expanded={open} aria-controls="zq-mmenu-list" aria-label={label} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth={1.6} />
        </svg>
        <span className="zq-hide-sm">{label}</span>
      </button>
      <nav id="zq-mmenu-list" className="zq-mmenu-list" hidden={!open} aria-label={t.allSections}>
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
