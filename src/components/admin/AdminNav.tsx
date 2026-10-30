"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/admin";
import { stripLocale } from "@/lib/i18n";

const LINKS: Array<{ href: string; label: string; roles: Role[] }> = [
  { href: "/admin", label: "Overview", roles: ["editor", "scholarly_reviewer", "moderator", "admin"] },
  { href: "/admin/review", label: "Review queue", roles: ["editor", "scholarly_reviewer", "admin"] },
  { href: "/admin/events/new", label: "New event", roles: ["editor", "admin"] },
  { href: "/admin/profiles", label: "Story editor", roles: ["editor", "admin"] },
  { href: "/admin/stories", label: "Stories", roles: ["editor", "admin"] },
  { href: "/admin/guidance", label: "Life Guidance", roles: ["editor", "admin"] },
  { href: "/admin/studio", label: "Story production", roles: ["editor", "scholarly_reviewer", "translation_reviewer", "audio_producer", "admin"] },
  { href: "/admin/studio/translations", label: "Translation review", roles: ["translation_reviewer", "scholarly_reviewer", "admin"] },
  { href: "/admin/studio/audio", label: "Audio QA & ambience", roles: ["audio_producer", "admin"] },
  { href: "/admin/relationships", label: "Genealogy edges", roles: ["editor", "admin"] },
  { href: "/admin/moderation", label: "Moderation", roles: ["moderator", "admin"] },
  { href: "/admin/corrections", label: "Corrections", roles: ["editor", "admin"] },
  { href: "/admin/sources", label: "Sources & licences", roles: ["admin"] },
  { href: "/admin/users", label: "Users & roles", roles: ["admin"] },
  { href: "/admin/audit", label: "Audit trail", roles: ["admin"] },
];

export function AdminNav({ roles }: { roles: Role[] }) {
  const path = stripLocale(usePathname());
  const isAdmin = roles.includes("admin");
  return (
    <nav aria-label="Editorial">
      <p className="zq-eyebrow" style={{ padding: "0 12px 8px" }}>
        {roles.map((r) => r.replace("_", " ")).join(" · ")}
      </p>
      {LINKS.filter((l) => isAdmin || l.roles.some((r) => roles.includes(r))).map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
