"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { Role } from "@/lib/admin";
import { stripLocale } from "@/lib/i18n";
import { adminStrings } from "@/lib/i18n/modules/admin";

const LINKS: Array<{ href: string; roles: Role[] }> = [
  { href: "/admin", roles: ["editor", "scholarly_reviewer", "moderator", "admin"] },
  { href: "/admin/review", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/life-through-ages", roles: ["editor", "scholarly_reviewer", "science_reviewer", "admin"] },
  { href: "/admin/events/new", roles: ["editor", "admin"] },
  { href: "/admin/events/universe", roles: ["editor", "scholarly_reviewer", "science_reviewer", "admin"] },
  { href: "/admin/events/coverage", roles: ["editor", "scholarly_reviewer", "science_reviewer", "admin"] },
  { href: "/admin/profiles", roles: ["editor", "admin"] },
  { href: "/admin/stories", roles: ["editor", "admin"] },
  { href: "/admin/stories/coverage", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/guidance", roles: ["editor", "admin"] },
  { href: "/admin/shifa", roles: ["editor", "scholarly_reviewer", "science_reviewer", "admin"] },
  { href: "/admin/hadith-stories", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/people", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/communities", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/studio", roles: ["editor", "scholarly_reviewer", "translation_reviewer", "audio_producer", "admin"] },
  { href: "/admin/studio/translations", roles: ["translation_reviewer", "scholarly_reviewer", "admin"] },
  { href: "/admin/studio/audio", roles: ["audio_producer", "admin"] },
  { href: "/admin/relationships", roles: ["editor", "admin"] },
  { href: "/admin/media", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/creation", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/moderation", roles: ["moderator", "admin"] },
  { href: "/admin/mufti", roles: ["moderator", "admin"] },
  { href: "/admin/site", roles: ["admin"] },
  { href: "/admin/dreams", roles: ["admin"] },
  { href: "/admin/corrections", roles: ["editor", "admin"] },
  { href: "/admin/editions", roles: ["editor", "admin"] },
  { href: "/admin/explanations", roles: ["editor", "scholarly_reviewer", "translation_reviewer", "admin"] },
  { href: "/admin/qiraat", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/sources", roles: ["admin"] },
  { href: "/admin/licences", roles: ["editor", "admin"] },
  { href: "/admin/users", roles: ["admin"] },
  { href: "/admin/audit", roles: ["admin"] },
];

/**
 * Editorial navigation. On phones and tablets it is a collapsible menu (a native disclosure) that closes after a
 * choice; from 1024px it is the open side column.
 */
export interface AdminNavLabels {
  menu: string;
  editorial: string;
  nav: Record<string, string>;
  roles: Record<string, string>;
}

const en = adminStrings("en");

export function AdminNav({ roles, labels }: { roles: Role[]; labels?: AdminNavLabels }) {
  const path = stripLocale(usePathname());
  const isAdmin = roles.includes("admin");
  const ref = useRef<HTMLDetailsElement>(null);
  const links = LINKS.filter((l) => isAdmin || l.roles.some((r) => roles.includes(r))).map((l) => ({ ...l, label: (labels ?? en).nav[l.href] ?? l.href }));
  const current = links.find((l) => l.href === path);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      d.open = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [path]);
  return (
    <nav aria-label={(labels ?? en).editorial} className="zq-admin-nav">
      <details ref={ref}>
        <summary>
          <span>{(labels ?? en).menu}</span>
          {current ? <span className="zq-admin-nav-now">{current.label}</span> : null}
        </summary>
        <p className="zq-eyebrow" style={{ padding: "0 12px 8px" }}>
          {roles.map((r) => labels?.roles[r] ?? r.replace("_", " ")).join(" · ")}
        </p>
        {links.map((l) => (
          <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </details>
    </nav>
  );
}
