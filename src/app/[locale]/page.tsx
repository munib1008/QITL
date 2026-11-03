import Link from "next/link";
import { getJourney, journeyStops } from "@/content/journey";
import { basmala, quranSource } from "@/content/quran";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { exploreLinks } from "@/lib/nav";
import { applyNav } from "@/lib/site-config/config";
import { getSiteConfig, homeText } from "@/lib/site-config/server";
import { JourneyTimeline } from "@/components/journey/JourneyTimeline";
import { JourneyDial, type DialStop } from "@/components/journey/JourneyDial";
import { ERA_TEXT } from "@/content/labels";
import { redesignStrings } from "@/lib/i18n/modules/redesign";
import { JourneyHeader } from "@/components/shell/SiteHeader";
import { DraftBadge } from "@/components/ui/evidence";
import { Mark } from "@/components/shell/Logo";
import { getDict } from "@/lib/i18n";
import { publicEnv } from "@/lib/env";
import { englishContent } from "@/lib/i18n/locales";
import { homeStrings } from "@/lib/i18n/modules/home";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { jsonForScript } from "@/lib/security/html";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = homeStrings(locale);
  const en = englishContent(locale);
  const journey = getJourney();
  const stops = journeyStops(journey);
  // A stop can present more than one prophet ("Musa & Harun"), so count names, not cards.
  const prophets = stops.filter((s) => s.type === "prophet").reduce((n, s) => n + s.name.split(" & ").length, 0);
  const milestones = stops.filter((s) => s.type === "milestone").length;
  const bsm = basmala();
  const rd = redesignStrings(locale);
  const dialStops: DialStop[] = stops.map((x) => ({ id: x.id, name: x.name, arabic: x.arabicName, eraLabel: x.era.label, dateLabel: x.era.label, certainty: x.era.certainty === "unknown" ? "relative" : x.era.certainty, certaintyLabel: ERA_TEXT[x.era.certainty] }));
  // Administrator-edited text and hidden sections (/admin/site). With no edit, every value equals the built-in string below.
  const cfg = await getSiteConfig();
  const builtInTitle = `${t.heroTitle} ${t.heroTitle2}`;
  const builtInLead = t.lead;
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
              t.lead
            ) : (
              txt["home.hero.lead"]
            )}
          </p>
          <div className="zq-heroact">
            <a className="zq-btn zq-btn-primary zq-btn-link" href="#journey">
              {t.begin}
            </a>
            <Link className="zq-btn zq-btn-secondary zq-btn-link" href="/quran">
              {t.exploreQuran}
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

        <section className="rd-homedial" aria-labelledby="dial-h">
          <div className="zq-sechead">
            <h2 id="dial-h">{rd.dial.heading}</h2>
            <p>{rd.dial.note}</p>
          </div>
          <JourneyDial stops={dialStops} s={rd.dial} href="/timeline?view=complete" />
        </section>

        <nav className="zq-rule" aria-label={t.livingTimeline} data-testid="era-rule">
          <ol>
            {journey.eras.map((era) => (
              <li key={era.title}>
                <a href="#journey" {...en}>
                  {era.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

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
          <ol className="zq-index" data-testid="explore-index">
            {applyNav(exploreLinks(locale), cfg)
              .filter((l) => l.href !== "/search")
              .map((l, i) => (
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
