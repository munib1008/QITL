import { AdminSite, type SiteLink } from "@/components/admin/AdminSite";
import { EmptyState } from "@/components/ui/misc";
import { getUser } from "@/lib/supabase/server";
import { siteAdminT } from "@/lib/i18n/modules/siteAdmin";
import { homeStrings } from "@/lib/i18n/modules/home";
import { exploreLinks } from "@/lib/nav";
import { isLocked, LANGS, type Lang, type TextKey } from "@/lib/site-config/config";

/** The built-in wording of each editable home block, per language: what visitors see until an administrator edits it. */
function builtIn(): Record<TextKey, Record<Lang, string>> {
  const out = {} as Record<TextKey, Record<Lang, string>>;
  const rows: Array<[TextKey, (h: ReturnType<typeof homeStrings>) => string]> = [
    ["home.hero.kicker", (h) => h.kicker],
    ["home.hero.title", (h) => `${h.heroTitle} ${h.heroTitle2}`],
    ["home.hero.lead", (h) => `${h.leadBefore} (عليه السلام) ${h.leadAfter}`],
    ["home.intro.kicker", (h) => h.livingTimeline],
    ["home.intro.title", (h) => h.followThread],
    ["home.intro.body", (h) => h.datesNote],
  ];
  for (const [key, pick] of rows) {
    out[key] = Object.fromEntries(LANGS.map((l) => [l, pick(homeStrings(l))])) as Record<Lang, string>;
  }
  return out;
}

/** Edit home wording and menus. Administrators only (inside the editorial shell, which gates on a staff role). */
export default async function AdminSitePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = siteAdminT(locale);
  const { sb, user } = await getUser();
  const isAdmin = sb && user ? (await sb.rpc("has_role", { r: "admin" })).data === true : false;
  const links: SiteLink[] = exploreLinks(locale).map((l) => ({ href: l.href, label: l.label, locked: isLocked(l.href) }));
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{t.title}</h1>
      <p className="zq-meta">{t.lead}</p>
      {isAdmin ? (
        <AdminSite locale={locale} links={links} fallbacks={builtIn()} />
      ) : (
        <EmptyState title={t.adminsOnly}>
          <p>{t.adminsOnlyBody}</p>
        </EmptyState>
      )}
    </div>
  );
}
