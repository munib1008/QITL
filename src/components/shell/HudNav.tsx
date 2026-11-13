"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { stripLocale } from "@/lib/i18n";
import type { NavLink } from "./SiteHeader";

/** The primary destinations with the current one marked (aria-current="page", drawn as the accent underline). */
export function HudNav({ links, label, children }: { links: NavLink[]; label: string; children?: ReactNode }) {
  const path = stripLocale(usePathname() ?? "/");
  const is = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  return (
    <nav className="navlinks" aria-label={label}>
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={is(l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
      {children}
    </nav>
  );
}
