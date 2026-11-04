import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { exploreLinks } from "@/lib/nav";
import { groupLinks } from "@/lib/nav-groups";
import { NAV_GROUP_IDS, navGroupStrings, type NavGroupId } from "@/lib/i18n/modules/navGroups";
import { LOCALES } from "@/lib/i18n";
import { applyNav } from "@/lib/site-config/config";
import { getSiteConfig } from "@/lib/site-config/server";
import "@/styles/nav-groups.css";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => NAV_GROUP_IDS.map((group) => ({ locale, group })));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; group: string }> }): Promise<Metadata> {
  const { locale, group } = await params;
  const g = navGroupStrings(locale).groups[group as NavGroupId];
  return g ? { title: g.label, description: g.note } : {};
}

/**
 * One learning category as a page: what it is for, and every section that belongs to it, with its one-line purpose. The list
 * comes from the same navigation table as the menus and the home index (exploreLinks, grouped by src/lib/nav-groups.ts), so a
 * section added there appears here, and a section an administrator hides is hidden here too.
 */
export default async function HubPage({ params }: { params: Promise<{ locale: string; group: string }> }) {
  const { locale, group } = await params;
  if (!(NAV_GROUP_IDS as readonly string[]).includes(group)) notFound();
  const s = navGroupStrings(locale);
  const g = s.groups[group as NavGroupId];
  const cfg = await getSiteConfig();
  const block = groupLinks(
    applyNav(exploreLinks(locale), cfg).filter((l) => l.href !== "/search"),
    locale,
  ).find((b) => b.id === group);
  const others = NAV_GROUP_IDS.filter((id) => id !== group);
  return (
    <ReadingPage locale={locale} crumbs={[{ label: g.label }]} kicker={<span className="pp-chap">QITL</span>} title={g.label} lead={g.note}>
      <div className="zq-pagebody" data-testid="hub-page" data-group={group}>
        {block?.links.length ? (
          <ol className="zq-index" data-testid="hub-sections">
            {block.links.map((l, i) => (
              <li key={l.href}>
                <span className="zq-index-no" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <Link href={l.href} className="zq-index-link">
                    {l.label}
                  </Link>
                  {l.note ? <p>{l.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        <nav aria-label={s.all} className="hub-others" data-testid="hub-others">
          <h2 className="zq-eyebrow">{s.all}</h2>
          <ul className="sd-index">
            {others.map((id) => (
              <li key={id}>
                <Link href={`/hub/${id}`}>{s.groups[id].label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </ReadingPage>
  );
}
