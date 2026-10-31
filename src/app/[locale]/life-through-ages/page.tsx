import type { Metadata } from "next";
import Link from "next/link";
import { BASE, LtaShell } from "@/components/lifestyle/Shell";
import { CategoryBadge } from "@/components/lifestyle/Evidence";
import { Scene } from "@/components/lifestyle/Scene";
import { journeyStops } from "@/content/journey";
import { lifestyleStrings } from "@/lib/i18n/modules/lifestyle";
import { CATEGORIES } from "@/lib/lifestyle/model";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const l = (await params).locale;
  const t = lifestyleStrings(l);
  return {
  title: t.title,
  description: t.lead,
  alternates: { canonical: BASE },
};
}

export default async function LifeThroughAgesHub({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = lifestyleStrings(locale);
  const prophets = journeyStops().filter((s) => s.type === "prophet");
  const tiles: Array<[string, string, string]> = [
    [`${BASE}/food`, t.sections.food, t.sections.foodNote],
    [`${BASE}/day`, t.sections.day, t.sections.dayNote],
    [`${BASE}/compare`, t.sections.compare, t.sections.compareNote],
    [`${BASE}/longevity`, t.sections.longevity, t.sections.longevityNote],
    ["/timeline?layer=lifestyle", t.layers.label, t.layers.lifestyle],
  ];
  return (
    <LtaShell locale={locale} section="hub" title={t.title} lead={t.lead}>
      <p className="lta-notice">{t.draftNotice}</p>

      <section className="lta-section" aria-labelledby="lta-cats-h">
        <h2 id="lta-cats-h">{t.categoriesTitle}</h2>
        <ul className="lta-cats">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <CategoryBadge category={c} t={t} />
              <span>{t.categoryHelp[c]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="lta-section" aria-labelledby="lta-explore-h">
        <h2 id="lta-explore-h">{t.title}</h2>
        <div className="lta-grid">
          {tiles.map(([href, title, note]) => (
            <Link key={href} className="lta-tile" href={href}>
              <b>{title}</b>
              <span>{note}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="lta-section" aria-labelledby="lta-prophets-h">
        <h2 id="lta-prophets-h">{t.sections.prophets}</h2>
        <p className="zq-meta">{t.sections.prophetsNote}. {t.prophet.noDates}</p>
        <div className="lta-grid">
          {prophets.map((p) => (
            <Link key={p.id} className="lta-tile" href={`${BASE}/prophets/${p.id}`}>
              <b>
                {p.name} <span lang="ar">{p.honorific}</span>
              </b>
              <span lang="ar" dir="rtl">
                {p.arabicName}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="lta-section" aria-labelledby="lta-lessons-h">
        <h2 id="lta-lessons-h">{t.sections.lessons}</h2>
        <div className="lta-lessons">
          <section>
            <h3>{t.lessons.religious}</h3>
            <p className="zq-meta">{t.lessons.religiousNote}</p>
          </section>
          <section>
            <h3>{t.lessons.modern}</h3>
            <p className="zq-meta">{t.lessons.modernNote}</p>
          </section>
        </div>
      </section>

      <section className="lta-section" aria-label={t.illustration.note}>
        <div className="lta-scenes">
          <Scene scene="fields" labels={t.illustration} />
          <Scene scene="mud-brick" labels={t.illustration} />
          <Scene scene="trade-route" labels={t.illustration} />
        </div>
      </section>
    </LtaShell>
  );
}
