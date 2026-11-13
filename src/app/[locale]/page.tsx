import Link from "next/link";
import { getJourney, journeyStops } from "@/content/journey";
import { basmala, quranSource } from "@/content/quran";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { exploreLinks } from "@/lib/nav";
import { groupLinks } from "@/lib/nav-groups";
import "@/styles/nav-groups.css";
import { applyNav } from "@/lib/site-config/config";
import { getSiteConfig, homeText } from "@/lib/site-config/server";
import { JourneyTimeline } from "@/components/journey/JourneyTimeline";
import { JourneyMap, type MapStop } from "@/components/journey/JourneyMap";
import { redesignStrings } from "@/lib/i18n/modules/redesign";
import { HudHeader, SiteFooter } from "@/components/shell/SiteHeader";
import { DraftBadge } from "@/components/ui/evidence";
import { publicEnv } from "@/lib/env";
import { englishContent } from "@/lib/i18n/locales";
import { eraText } from "@/lib/i18n/modules/eras";
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
  const mapStops: MapStop[] = journey.eras.flatMap((era, eraIndex) =>
    era.items.map((x) => ({
      id: x.id,
      name: x.name,
      arabic: x.arabicName,
      honorific: x.honorific,
      chapter: x.chapter,
      kind: x.type,
      eraIndex,
      eraLabel: x.era.label,
      summary: x.summary,
      href: `/prophets/${x.id}`,
    })),
  );
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
    <div className="pp zq-page" id="top">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(jsonLd) }} />
      <HudHeader locale={locale} config={cfg} />
      <main id="main">
        <section className="qs hero2 container" aria-labelledby="hero-title">
          <div className="kick">
            <div className="eyebrow">{txt["home.hero.kicker"]}</div>
            {bsm ? (
              <p className="basm arabic" lang="ar" dir="rtl">
                {bsm}
              </p>
            ) : null}
          </div>
          <div className="titlerow">
            <h1 id="hero-title">
              {txt["home.hero.title"] === builtInTitle ? (
                <>
                  <span style={{ display: "block" }}>{t.heroTitle}</span>
                  <em>{t.heroTitle2}</em>
                </>
              ) : (
                txt["home.hero.title"]
              )}
            </h1>
            <div className="side">
              <p>{txt["home.hero.lead"] === builtInLead ? t.lead : txt["home.hero.lead"]}</p>
              <div className="cta">
                <a className="btn gold" href="#journey">
                  {t.begin}
                </a>
                <Link className="btn" href="/quran">
                  {t.exploreQuran}
                </Link>
              </div>
            </div>
          </div>
          <JourneyMap
            stops={mapStops}
            badge={<DraftBadge status={journey.status} />}
            s={{
              label: rd.dial.label,
              heading: rd.dial.heading,
              note: rd.dial.note,
              keyHint: t.mapKeys,
              chapter: t.chapter,
              milestone: t.milestone,
              open: t.open,
              of: t.of,
              eras: journey.eras.map((e) => eraText(locale, e.title).text),
            }}
          />
          <div className="hero-stats">
            {/* These counts are computed from the journey content, never typed in. */}
            <div>
              <strong>{prophets}</strong>
              <span>{t.prophetsNamed}</span>
            </div>
            <div>
              <strong>{milestones}</strong>
              <span>{t.milestones}</span>
            </div>
            <div>
              <strong>{t.every}</strong>
              <span>{t.everyDate}</span>
            </div>
          </div>
        </section>

        <nav className="zq-rule" aria-label={t.livingTimeline} data-testid="era-rule">
          <ol>
            {journey.eras.map((era) => (
              <li key={era.title}>
                <a href="#journey" {...(eraText(locale, era.title).english ? en : {})}>
                  {eraText(locale, era.title).text}
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
          <div className="zq-index-groups" data-testid="explore-index">
            {(() => {
              let no = 0;
              return groupLinks(
                applyNav(exploreLinks(locale), cfg).filter((l) => l.href !== "/search"),
                locale,
              ).map((b) => (
                <section key={b.id ?? "rest"} className="zq-index-group" aria-label={b.label ?? undefined}>
                  {b.label ? (
                    <h3>
                      <Link href={`/hub/${b.id}`}>{b.label}</Link>
                    </h3>
                  ) : null}
                  {b.note ? <p>{b.note}</p> : null}
                  <ol className="zq-index">
                    {b.links.map((l) => (
                      <li key={l.href}>
                        <span className="zq-index-no" aria-hidden="true">
                          {String(++no).padStart(2, "0")}
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
              ));
            })()}
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
      {bsm ? <QuranAttribution src={quranSource()} /> : null}
    </div>
  );
}
