import Link from "next/link";
import { getJourney, journeyStops } from "@/content/journey";
import { basmala, quranSource } from "@/content/quran";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { exploreLinks } from "@/lib/nav";
import { applyNav } from "@/lib/site-config/config";
import { getSiteConfig, homeText } from "@/lib/site-config/server";
import { JourneyTimeline } from "@/components/journey/JourneyTimeline";
import { JourneyHeader } from "@/components/shell/SiteHeader";
import { DraftBadge } from "@/components/ui/evidence";
import { Rosette } from "@/components/ui/icons";
import { Mark } from "@/components/shell/Logo";
import { getDict } from "@/lib/i18n";
import { publicEnv } from "@/lib/env";
import { homeStrings } from "@/lib/i18n/modules/home";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { jsonForScript } from "@/lib/security/html";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = homeStrings(locale);
  const journey = getJourney();
  const stops = journeyStops(journey);
  // A stop can present more than one prophet ("Musa & Harun"), so count names, not cards.
  const prophets = stops.filter((s) => s.type === "prophet").reduce((n, s) => n + s.name.split(" & ").length, 0);
  const milestones = stops.filter((s) => s.type === "milestone").length;
  const bsm = basmala();
  // Administrator-edited text and hidden sections (/admin/site). With no edit, every value equals the built-in string below.
  const cfg = await getSiteConfig();
  const builtInTitle = `${t.heroTitle} ${t.heroTitle2}`;
  const builtInLead = `${t.leadBefore} (عليه السلام) ${t.leadAfter}`;
  const txt = await homeText(locale, {
    "home.hero.kicker": t.kicker,
    "home.hero.title": builtInTitle,
    "home.hero.lead": builtInLead,
    "home.intro.kicker": t.livingTimeline,
    "home.intro.title": t.followThread,
    "home.intro.body": t.datesNote,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: uiStrings(locale).site.title,
    url: publicEnv.siteUrl,
    inLanguage: ["en", "ar", "ur"],
    potentialAction: { "@type": "SearchAction", target: `${publicEnv.siteUrl}/search?q={query}`, "query-input": "required name=query" },
  };

  return (
    <div className="zq-page" data-theme="journey" id="top">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(jsonLd) }} />
      <JourneyHeader locale={locale} config={cfg} />
      <main id="main">
        <section className="zq-hero" aria-labelledby="hero-title">
          {bsm ? (
            <p className="zq-basmala" lang="ar" dir="rtl">
              {bsm}
            </p>
          ) : null}
          <span className="zq-kicker">{txt["home.hero.kicker"]}</span>
          <h1 id="hero-title">
            {txt["home.hero.title"] === builtInTitle ? (
              <>
                {t.heroTitle}
                <span>{t.heroTitle2}</span>
              </>
            ) : (
              txt["home.hero.title"]
            )}
          </h1>
          <p className="zq-lead">
            {txt["home.hero.lead"] === builtInLead ? (
              <>
                {t.leadBefore} <span lang="ar">(عليه السلام)</span> {t.leadAfter}
              </>
            ) : (
              txt["home.hero.lead"]
            )}
          </p>
          <div className="zq-heroact">
            <a className="zq-btn zq-btn-primary zq-btn-link" href="#journey">
              {t.begin}
            </a>
            <Link className="zq-btn zq-btn-secondary zq-btn-link" href="/methodology">
              {t.how}
            </Link>
          </div>
          <div className="zq-facts">
            {/* These counts are computed from the journey content, never typed in. */}
            <div>
              <b>{prophets}</b>
              <span>{t.prophetsNamed}</span>
            </div>
            <div>
              <b>{milestones}</b>
              <span>{t.milestones}</span>
            </div>
            <div>
              <b>{t.every}</b>
              <span>{t.everyDate}</span>
            </div>
          </div>
        </section>

        <div id="journey">
          <JourneyTimeline
            eras={journey.eras}
            initialActive={stops[0]?.id}
            draft={journey.status !== "published"}
            intro={
              <div className="zq-sechead">
                <span className="zq-kicker">{txt["home.intro.kicker"]}</span>
                <h2>{txt["home.intro.title"]}</h2>
                <p>{txt["home.intro.body"]}</p>
                <div style={{ marginTop: 16 }}>
                  <DraftBadge status={journey.status} />
                </div>
              </div>
            }
            endLabel={t.continues}
            endNote={t.endNote}
            endActions={
              <div className="zq-row" style={{ justifyContent: "center", padding: 0 }}>
                <Link className="zq-btn zq-btn-primary zq-btn-sm zq-btn-link" href="/atlas">
                  {t.toAtlas}
                </Link>
                <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href="/quran">
                  {t.toQuran}
                </Link>
                <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href="/prophets">
                  {t.allProphets}
                </Link>
              </div>
            }
          />
        </div>

        <section id="explore" style={{ paddingTop: 64 }} aria-labelledby="explore-title">
          <div className="zq-sechead">
            <span className="zq-kicker">{t.moreWays}</span>
            <h2 id="explore-title">{t.everyStory}</h2>
          </div>
          <div className="zq-features zq-features-all">
            {applyNav(exploreLinks(locale), cfg)
              .filter((l) => l.href !== "/search")
              .map((l, i) => (
                <Feature key={l.href} title={l.label} points={([8, 10, 12] as const)[i % 3]!} href={l.href}>
                  {l.note ?? ""}
                </Feature>
              ))}
          </div>
        </section>
      </main>
      <footer className="zq-foot" id="method">
        <span className="zq-foot-mark">
          <Mark size={36} tone="dark" />
          <span>{uiStrings(locale).site.title}</span>
        </span>
        <span>{getDict(locale).t.footer.principles}</span>
        <nav className="zq-foot-links" aria-label={t.about}>
          <Link href="/about">{t.footerAbout}</Link>
          <Link href="/methodology">{t.footerMethodology}</Link>
          <Link href="/privacy">{t.footerPrivacy}</Link>
          <Link href="/accessibility">{t.footerAccessibility}</Link>
        </nav>
        {bsm ? <QuranAttribution src={quranSource()} /> : null}
      </footer>
    </div>
  );
}

/** One card per section of QITL (the same list as the Explore menus). Each section states its own data status. */
function Feature({ title, points, href, children }: { title: string; points: 8 | 10 | 12; href: string; children: React.ReactNode }) {
  return (
    <article className="zq-feature zq-glass">
      <Rosette points={points} />
      <h3>
        <Link href={href} className="zq-feature-link">
          {title}
        </Link>
      </h3>
      {children ? <p>{children}</p> : null}
    </article>
  );
}
