import Link from "next/link";
import { getJourney, journeyStops } from "@/content/journey";
import { basmala } from "@/content/quran";
import { JourneyTimeline } from "@/components/journey/JourneyTimeline";
import { JourneyHeader } from "@/components/shell/SiteHeader";
import { DraftBadge } from "@/components/ui/evidence";
import { Rosette } from "@/components/ui/icons";
import { Mark } from "@/components/shell/Logo";
import { publicEnv } from "@/lib/env";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const journey = getJourney();
  const stops = journeyStops(journey);
  // A stop can present more than one prophet ("Musa & Harun"), so count names, not cards.
  const prophets = stops.filter((s) => s.type === "prophet").reduce((n, s) => n + s.name.split(" & ").length, 0);
  const milestones = stops.filter((s) => s.type === "milestone").length;
  const bsm = basmala();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "QITL — Quran in Timeline",
    url: publicEnv.siteUrl,
    inLanguage: ["en", "ar"],
    potentialAction: { "@type": "SearchAction", target: `${publicEnv.siteUrl}/search?q={query}`, "query-input": "required name=query" },
  };

  return (
    <div className="zq-page" data-theme="journey" id="top">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <JourneyHeader locale={locale} />
      <main id="main">
        <section className="zq-hero" aria-labelledby="hero-title">
          {bsm ? (
            <p className="zq-basmala" lang="ar" dir="rtl">
              {bsm}
            </p>
          ) : null}
          <span className="zq-kicker">A journey through sacred history</span>
          <h1 id="hero-title">
            From the beginning.<span>To the final Messenger.</span>
          </h1>
          <p className="zq-lead">
            From Adam <span lang="ar">(عليه السلام)</span> to the passing of the Prophet Muhammad ﷺ — every prophet named in the
            Quran, the surahs that tell his story, and every date marked with how certain it is.
          </p>
          <div className="zq-heroact">
            <a className="zq-btn zq-btn-primary zq-btn-link" href="#journey">
              Begin the journey
            </a>
            <Link className="zq-btn zq-btn-secondary zq-btn-link" href="/methodology">
              How it works
            </Link>
          </div>
          <div className="zq-facts">
            {/* These counts are computed from the journey content, never typed in. */}
            <div>
              <b>{prophets}</b>
              <span>prophets named in the Quran</span>
            </div>
            <div>
              <b>{milestones}</b>
              <span>milestones of the final Messenger ﷺ</span>
            </div>
            <div>
              <b>Every</b>
              <span>date labelled by certainty</span>
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
                <span className="zq-kicker">The living timeline</span>
                <h2>Follow the thread of revelation.</h2>
                <p>Dates appear only where history supports them. Undated eras stay undated, and disputed positions say so.</p>
                <div style={{ marginTop: 16 }}>
                  <DraftBadge status={journey.status} />
                </div>
              </div>
            }
            endLabel="The journey continues"
            endNote="The passing of the Prophet ﷺ closes this journey, not the history of Islam."
            endActions={
              <div className="zq-row" style={{ justifyContent: "center", padding: 0 }}>
                <Link className="zq-btn zq-btn-primary zq-btn-sm zq-btn-link" href="/atlas">
                  Continue to the atlas
                </Link>
                <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href="/quran">
                  Explore Quran references
                </Link>
                <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href="/prophets">
                  View all prophets
                </Link>
              </div>
            }
          />
        </div>

        <section id="explore" style={{ paddingTop: 64 }} aria-labelledby="explore-title">
          <div className="zq-sechead">
            <span className="zq-kicker">More ways to understand</span>
            <h2 id="explore-title">Every story, in context.</h2>
          </div>
          <div className="zq-features">
            <Feature title="Interactive atlas" points={8} href="/atlas">
              Documented places, journeys and clearly shaded areas of geographic uncertainty.
            </Feature>
            <Feature title="Evidence first" points={10} href="/methodology">
              Quran passages, hadith references, gradings and reviewer notes behind every stop.
            </Feature>
            <Feature title="Connected genealogy" points={12} href="/genealogy">
              Source-backed family relationships without invented generations.
            </Feature>
          </div>
        </section>
      </main>
      <footer className="zq-foot" id="method">
        <span className="zq-foot-mark">
          <Mark size={36} tone="dark" />
          <span>QITL — Quran in Timeline</span>
        </span>
        <span>Respecting evidence · Preserving uncertainty · Learning together</span>
        <nav className="zq-foot-links" aria-label="About">
          <Link href="/about">About</Link>
          <Link href="/methodology">Methodology</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/accessibility">Accessibility</Link>
        </nav>
      </footer>
    </div>
  );
}

/** Feature cards stay labelled "Coming soon" until the feature behind them is wired to reviewed data. */
function Feature({ title, points, href, children }: { title: string; points: 8 | 10 | 12; href: string; children: React.ReactNode }) {
  return (
    <article className="zq-feature zq-glass">
      <Rosette points={points} />
      <h3>
        <Link href={href} className="zq-feature-link">
          {title}
        </Link>
      </h3>
      <p>{children}</p>
      <span className="zq-soon">Coming soon</span>
    </article>
  );
}
