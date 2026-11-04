"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import type { NavLink } from "./SiteHeader";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";
import { groupLinks } from "@/lib/nav-groups";
import "@/styles/nav-groups.css";

/**
 * A disclosure menu of section links. "mobile" (default) is the header menu below 1024px; "more" sits at the end of the
 * desktop section bar for the sections that do not fit in it. Esc closes and returns focus to the button.
 */
export function MobileMenu({ links, label, variant = "mobile" }: { links: NavLink[]; label: string; variant?: "mobile" | "more" }) {
  const [open, setOpen] = useState(false);
  const listId = `zq-mmenu-${useId().replace(/:/g, "")}`;
  const btn = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const locale = useLocale();
  const t = uiStrings(locale).shell;
  const blocks = groupLinks(links, locale);
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
    <div className={variant === "more" ? "zq-mmenu zq-mmenu-more" : "zq-mmenu"}>
      <button ref={btn} type="button" className="zq-btn zq-btn-quiet zq-btn-sm" aria-expanded={open} aria-controls={listId} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth={1.6} />
        </svg>
        <span className="zq-hide-sm">{label}</span>
      </button>
      <nav id={listId} className="zq-mmenu-list" hidden={!open} aria-label={t.allSections}>
        {blocks.map((b) => (
          <Fragment key={b.id ?? "rest"}>
            {b.label ? <p className="zq-mmenu-group">{b.label}</p> : null}
            {b.links.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </Fragment>
        ))}
      </nav>
    </div>
  );
}
