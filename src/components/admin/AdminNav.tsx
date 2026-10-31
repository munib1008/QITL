"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { Role } from "@/lib/admin";
import { stripLocale } from "@/lib/i18n";

const LINKS: Array<{ href: string; label: string; roles: Role[] }> = [
  { href: "/admin", label: "Overview", roles: ["editor", "scholarly_reviewer", "moderator", "admin"] },
  { href: "/admin/review", label: "Review queue", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/life-through-ages", label: "Life Through the Ages", roles: ["editor", "scholarly_reviewer", "science_reviewer", "admin"] },
  { href: "/admin/events/new", label: "New event", roles: ["editor", "admin"] },
  { href: "/admin/events/universe", label: "Event Universe", roles: ["editor", "scholarly_reviewer", "science_reviewer", "admin"] },
  { href: "/admin/events/coverage", label: "Event coverage", roles: ["editor", "scholarly_reviewer", "science_reviewer", "admin"] },
  { href: "/admin/profiles", label: "Story editor", roles: ["editor", "admin"] },
  { href: "/admin/stories", label: "Stories", roles: ["editor", "admin"] },
  { href: "/admin/guidance", label: "Life Guidance", roles: ["editor", "admin"] },
  { href: "/admin/studio", label: "Story production", roles: ["editor", "scholarly_reviewer", "translation_reviewer", "audio_producer", "admin"] },
  { href: "/admin/studio/translations", label: "Translation review", roles: ["translation_reviewer", "scholarly_reviewer", "admin"] },
  { href: "/admin/studio/audio", label: "Audio QA & ambience", roles: ["audio_producer", "admin"] },
  { href: "/admin/relationships", label: "Genealogy edges", roles: ["editor", "admin"] },
  { href: "/admin/media", label: "Media Library", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/creation", label: "Creation Atlas", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/moderation", label: "Moderation", roles: ["moderator", "admin"] },
  { href: "/admin/mufti", label: "Mufti Q&A", roles: ["moderator", "admin"] },
  { href: "/admin/dreams", label: "Dream requests", roles: ["admin"] },
  { href: "/admin/corrections", label: "Corrections", roles: ["editor", "admin"] },
  { href: "/admin/editions", label: "Translation editions", roles: ["editor", "admin"] },
  { href: "/admin/explanations", label: "Explanations & checks", roles: ["editor", "scholarly_reviewer", "translation_reviewer", "admin"] },
  { href: "/admin/qiraat", label: "Qira'at", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/sources", label: "Sources & licences", roles: ["admin"] },
  { href: "/admin/licences", label: "Content licences", roles: ["editor", "admin"] },
  { href: "/admin/users", label: "Users & roles", roles: ["admin"] },
  { href: "/admin/audit", label: "Audit trail", roles: ["admin"] },
];

/**
 * Editorial navigation. On phones and tablets it is a collapsible menu (a native disclosure) that closes after a
 * choice; from 1024px it is the open side column.
 */
export function AdminNav({ roles }: { roles: Role[] }) {
  const path = stripLocale(usePathname());
  const isAdmin = roles.includes("admin");
  const ref = useRef<HTMLDetailsElement>(null);
  const links = LINKS.filter((l) => isAdmin || l.roles.some((r) => roles.includes(r)));
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
    <nav aria-label="Editorial" className="zq-admin-nav">
      <details ref={ref}>
        <summary>
          <span>Editorial menu</span>
          {current ? <span className="zq-admin-nav-now">{current.label}</span> : null}
        </summary>
        <p className="zq-eyebrow" style={{ padding: "0 12px 8px" }}>
          {roles.map((r) => r.replace("_", " ")).join(" · ")}
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
