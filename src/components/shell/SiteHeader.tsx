import Link from "next/link";
import { draftNotice, getDict } from "@/lib/i18n";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { SearchField } from "@/components/ui/misc";
import { searchStrings } from "@/lib/i18n/modules/search";
import { Icon } from "@/components/ui/icons";
import { AccountLink } from "./AccountLink";
import { LangToggle } from "./toggles";
import { MobileMenu } from "./MobileMenu";
import { Logo, Mark } from "./Logo";
import { exploreLinks } from "@/lib/nav";
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

/** Home (journey theme): glass nav with The Journey / Explore / Methodology. */
/**
 * `config` is the administrator's menu configuration (/admin/site: hidden sections, Explore order); without it the menus are the
 * built-in ones. Hiding only removes a link from the menus.
 */
export function JourneyHeader({ locale, config }: { locale: string; config?: SiteConfig }) {
  const { locale: l, t } = getDict(locale);
  const u = uiStrings(locale).shell;
  return (
    <header className="zq-nav">
      <Link className="zq-brand" href="/" aria-label={u.brandHome}>
        <Logo height={52} tone="light" priority tagline={t.brandTagline} />
      </Link>
      <nav className="zq-links" aria-label={u.mainNav}>
        <a href="#journey">{t.nav.journey}</a>
        <a href="#explore">{t.nav.explore}</a>
        <Link href="/methodology">{t.nav.methodology}</Link>
      </nav>
      <div className="zq-navact">
        <LangToggle locale={l} labels={t.lang} />
        <Link className="zq-btn zq-btn-primary zq-btn-sm zq-btn-link" href="/prophets">
          {t.nav.begin}
        </Link>
        <MobileMenu links={[...mainNav(t, config), ...moreNav(l, t, config)]} label={t.nav.explore} />
      </div>
    </header>
  );
}

/** Reading pages (solid light/dark): brand, global search, language, theme, account. */
export function ReadingHeader({ locale, query, config }: { locale: string; query?: string; config?: SiteConfig }) {
  const { locale: l, t } = getDict(locale);
  const u = uiStrings(locale).shell;
  const st = searchStrings(l);
  return (
    <header className="pp-nav">
      <Link className="pp-brand" href="/" aria-label={u.brandHome}>
        <Logo height={44} priority tagline={t.brandTagline} />
      </Link>
      <SearchField maxWidth={420} defaultValue={query} id="hdr-q" label={st.fieldLabel} placeholder={st.placeholder} />
      <div className="pp-navact">
        <Link className="zq-btn zq-btn-quiet zq-btn-sm zq-btn-link pp-msearch" href="/search" aria-label={t.nav.search}>
          <Icon.search />
          <span className="zq-hide-sm">{t.nav.search}</span>
        </Link>
        <LangToggle locale={l} labels={t.lang} />
        <AccountLink signInLabel={t.nav.signIn} accountLabel={t.nav.account} />
        <MobileMenu links={[...mainNav(t, config), ...moreNav(l, t, config)]} label={t.nav.explore} />
      </div>
      <nav className="pp-sections" aria-label={u.sections}>
        {mainNav(t, config).map((n) => (
          <Link key={n.href} href={n.href}>
            {n.label}
          </Link>
        ))}
        <MobileMenu variant="more" links={moreNav(l, t, config)} label={t.nav.explore} />
      </nav>
    </header>
  );
}

export function SiteFooter({ locale }: { locale: string }) {
  const { t } = getDict(locale);
  const f = uiStrings(locale).footer;
  const u = uiStrings(locale).shell;
  return (
    <footer className="pp-foot zq-sitefoot">
      <div className="zq-foot-cols">
        <div>
          <span className="zq-foot-mark">
            <Mark size={40} />
            <b className="zq-foot-brand">QITL</b>
          </span>
          <p className="zq-meta">{t.footer.principles}</p>
          {draftNotice(t) ? <p className="zq-meta">{draftNotice(t)}</p> : null}
        </div>
        <nav aria-label={u.about}>
          <Link href="/about">{f.about}</Link>
          <Link href="/methodology">{f.methodology}</Link>
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
      <p className="zq-meta">{t.footer.corrections}</p>
    </footer>
  );
}
