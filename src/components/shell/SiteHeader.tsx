import Link from "next/link";
import { draftNotice, getDict } from "@/lib/i18n";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { Icon, Rosette } from "@/components/ui/icons";
import { hudStrings } from "@/lib/i18n/modules/hud";
import { AccountLink } from "./AccountLink";
import { LangToggle } from "./toggles";
import { MobileMenu } from "./MobileMenu";
import { HudNav } from "./HudNav";
import { SearchTrigger } from "./SearchTrigger";
import { ThemeToggle } from "./ThemeToggle";
import { exploreLinks } from "@/lib/nav";
import { verificationStrings } from "@/lib/i18n/modules/verification";
import { applyNav, EMPTY_CONFIG, type SiteConfig } from "@/lib/site-config/config";

export interface NavLink {
  href: string;
  label: string;
}

/** Sections reachable only through the menus (everything in exploreLinks that the section bar does not list). */
export function moreNav(locale: string, t: ReturnType<typeof getDict>["t"], config: SiteConfig = EMPTY_CONFIG): NavLink[] {
  const shown = new Set(mainNav(t).map((n) => n.href));
  return applyNav(
    exploreLinks(locale).filter((l) => !shown.has(l.href) && l.href !== "/search").map(({ href, label }) => ({ href, label })),
    config,
  );
}

export function mainNav(t: ReturnType<typeof getDict>["t"], config: SiteConfig = EMPTY_CONFIG): NavLink[] {
  return applyNav([
    { href: "/prophets", label: t.nav.prophets },
    { href: "/timeline", label: t.nav.timeline },
    { href: "/atlas", label: t.nav.atlas },
    { href: "/quran", label: t.nav.quran },
    { href: "/hadith", label: t.nav.hadith },
    { href: "/events", label: t.nav.events },
    { href: "/stories", label: t.nav.stories },
    { href: "/genealogy", label: t.nav.genealogy },
    { href: "/last-hour", label: t.nav.lastHour },
    { href: "/community", label: t.nav.community },
  ], config);
}

export function Brand({ tagline, label }: { tagline: string; label: string }) {
  return (
    <Link className="brand" href="/" aria-label={label}>
      <Rosette points={8} className="brandmark" />
      <span>
        <strong>QITL</strong>
        <small>{tagline}</small>
      </span>
    </Link>
  );
}

/**
 * The one header, used on every route (home included): a thin strip with the site's promise, then the brand, the four
 * primary destinations, the Explore menu (every other section), search (opens the command palette, Ctrl K), theme,
 * language and account. `config` is the administrator's menu configuration (/admin/site: hidden sections, Explore order);
 * hiding only removes a link from the menus. Below 900px the section links move to the bottom bar and the Explore sheet.
 */
export function HudHeader({ locale, config }: { locale: string; config?: SiteConfig }) {
  const { locale: l, t } = getDict(locale);
  const u = uiStrings(locale).shell;
  const h = hudStrings(locale);
  const primary = applyNav(
    [
      { href: "/", label: h.nav.discover },
      { href: "/prophets", label: h.nav.journey },
      { href: "/quran", label: h.nav.quran },
      { href: "/atlas", label: h.nav.atlas },
    ],
    config ?? EMPTY_CONFIG,
  );
  return (
    <div className="qs hud">
      <div className="topbar">
        <span className="spark" aria-hidden="true">
          ✧
        </span>{" "}
        {h.topbar.lead} <span aria-hidden="true">·</span> <b>{h.topbar.tag}</b>
      </div>
      <div className="navwrap">
        <header className="nav container">
          <Brand tagline={t.brandTagline} label={u.brandHome} />
          <HudNav links={primary} label={u.mainNav}>
            <MobileMenu variant="more" links={[...mainNav(t, config), ...moreNav(l, t, config)]} label={h.nav.explore} />
          </HudNav>
          <div className="navtools">
            <SearchTrigger className="searchbtn" label={h.search.open}>
              <Icon.search />
              <span>{h.search.button}</span>
              <kbd aria-hidden="true">Ctrl K</kbd>
            </SearchTrigger>
            <ThemeToggle />
            <LangToggle locale={l} labels={t.lang} />
            <AccountLink signInLabel={t.nav.signIn} accountLabel={t.nav.account} />
          </div>
        </header>
      </div>
    </div>
  );
}

export function SiteFooter({ locale }: { locale: string }) {
  const { t } = getDict(locale);
  const f = uiStrings(locale).footer;
  const u = uiStrings(locale).shell;
  return (
    <footer className="qs pp-foot">
      <div className="sitefooter container">
        <div className="footerintro">
          <Brand tagline={t.brandTagline} label={u.brandHome} />
          <p>{t.footer.principles}</p>
          {draftNotice(t) ? <p>{draftNotice(t)}</p> : null}
        </div>
        <div className="footerlinks">
          <nav aria-label={u.about}>
            <Link href="/about">{f.about}</Link>
            <Link href="/methodology">{f.methodology}</Link>
            <Link href="/verification">{verificationStrings(locale).page.title}</Link>
            <Link href="/review-board">{f.reviewBoard}</Link>
            <Link href="/corrections">{f.corrections}</Link>
          </nav>
          <nav aria-label={u.legal}>
            <Link href="/terms">{f.terms}</Link>
            <Link href="/privacy">{f.privacy}</Link>
            <Link href="/accessibility">{f.accessibility}</Link>
            <Link href="/contact">{f.contact}</Link>
          </nav>
        </div>
      </div>
      <div className="footerbottom container">
        <span>{t.footer.corrections}</span>
      </div>
    </footer>
  );
}
