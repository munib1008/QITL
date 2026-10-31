import Link from "next/link";
import { draftNotice, getDict } from "@/lib/i18n";
import { SearchField } from "@/components/ui/misc";
import { searchStrings } from "@/lib/i18n/modules/search";
import { Icon } from "@/components/ui/icons";
import { AccountLink } from "./AccountLink";
import { LangToggle, ThemeToggle } from "./toggles";
import { MobileMenu } from "./MobileMenu";
import { Logo, Mark } from "./Logo";
import { exploreLinks } from "@/lib/nav";
import { BRAND_FULL } from "@/lib/brand";

export interface NavLink {
  href: string;
  label: string;
}

/** Sections reachable only through the menus (everything in exploreLinks that the section bar does not list). */
export function moreNav(locale: string, t: ReturnType<typeof getDict>["t"]): NavLink[] {
  const shown = new Set(mainNav(t).map((n) => n.href));
  return exploreLinks(locale).filter((l) => !shown.has(l.href) && l.href !== "/search").map(({ href, label }) => ({ href, label }));
}

export function mainNav(t: ReturnType<typeof getDict>["t"]): NavLink[] {
  return [
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
  ];
}

/** Home (journey theme): glass nav with The Journey / Explore / Methodology. */
export function JourneyHeader({ locale }: { locale: string }) {
  const { locale: l, t } = getDict(locale);
  return (
    <header className="zq-nav">
      <Link className="zq-brand" href="/" aria-label={`${BRAND_FULL}, home`}>
        <Logo height={52} tone="dark" priority tagline={t.brandTagline} />
      </Link>
      <nav className="zq-links" aria-label="Main">
        <a href="#journey">{t.nav.journey}</a>
        <a href="#explore">{t.nav.explore}</a>
        <Link href="/methodology">{t.nav.methodology}</Link>
      </nav>
      <div className="zq-navact">
        <LangToggle locale={l} labels={t.lang} />
        <Link className="zq-btn zq-btn-primary zq-btn-sm zq-btn-link" href="/prophets">
          {t.nav.begin}
        </Link>
        <MobileMenu links={[...mainNav(t), ...moreNav(l, t)]} label={t.nav.explore} />
      </div>
    </header>
  );
}

/** Reading pages (solid light/dark): brand, global search, language, theme, account. */
export function ReadingHeader({ locale, query }: { locale: string; query?: string }) {
  const { locale: l, t } = getDict(locale);
  const st = searchStrings(l);
  return (
    <header className="pp-nav">
      <Link className="pp-brand" href="/" aria-label={`${BRAND_FULL}, home`}>
        <Logo height={44} priority tagline={t.brandTagline} />
      </Link>
      <SearchField maxWidth={420} defaultValue={query} id="hdr-q" label={st.fieldLabel} placeholder={st.placeholder} />
      <div className="pp-navact">
        <Link className="zq-btn zq-btn-quiet zq-btn-sm zq-btn-link pp-msearch" href="/search" aria-label={t.nav.search}>
          <Icon.search />
          <span className="zq-hide-sm">{t.nav.search}</span>
        </Link>
        <ThemeToggle labels={t.theme} />
        <LangToggle locale={l} labels={t.lang} />
        <AccountLink signInLabel={t.nav.signIn} accountLabel={t.nav.account} />
        <MobileMenu links={[...mainNav(t), ...moreNav(l, t)]} label={t.nav.explore} />
      </div>
      <nav className="pp-sections" aria-label="Sections">
        {mainNav(t).map((n) => (
          <Link key={n.href} href={n.href}>
            {n.label}
          </Link>
        ))}
        <MobileMenu variant="more" links={moreNav(l, t)} label={t.nav.explore} />
      </nav>
    </header>
  );
}

export function SiteFooter({ locale }: { locale: string }) {
  const { t } = getDict(locale);
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
        <nav aria-label="About">
          <Link href="/about">About</Link>
          <Link href="/methodology">Source methodology</Link>
          <Link href="/review-board">Scholarly review board</Link>
          <Link href="/corrections">Corrections</Link>
        </nav>
        <nav aria-label="Legal">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/accessibility">Accessibility</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
      <p className="zq-meta">{t.footer.corrections}</p>
    </footer>
  );
}
