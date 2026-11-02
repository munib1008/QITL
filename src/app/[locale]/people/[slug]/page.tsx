import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiDraftStory } from "@/components/drafts/AiDraftStory";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EventsSection, FamilySection, IdentificationBlock, Name, NotEstablished, QuranSection, StoryLinks } from "@/components/encyclopedia/Encyclopedia";
import { EmptyState } from "@/components/ui/misc";
import { personBySlug } from "@/lib/data/encyclopedia";
import { SLUG_RE } from "@/lib/encyclopedia/model";
import { getDict } from "@/lib/i18n";
import { encyclopediaStrings } from "@/lib/i18n/modules/encyclopedia";
import { hadithStoryStrings } from "@/lib/i18n/modules/hadithStories";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = encyclopediaStrings(locale);
  const p = SLUG_RE.test(slug) ? await personBySlug(slug) : undefined;
  return p ? { title: p.name_en, description: p.summary ?? t.people.lead } : { title: t.people.title };
}

export default async function PersonPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const { locale } = getDict(raw);
  const t = encyclopediaStrings(locale);
  const hs = hadithStoryStrings(locale);
  if (!SLUG_RE.test(slug)) notFound();
  const p = await personBySlug(slug);
  const crumbs = [{ href: "/people", label: t.people.crumb }];
  if (p === null)
    return (
      <ReadingPage locale={raw} crumbs={[...crumbs, { label: t.people.title }]} title={t.people.title}>
        <div className="zq-pagebody">
          <EmptyState title={t.people.notConnected} />
        </div>
      </ReadingPage>
    );
  if (!p) notFound();
  const s = t.sections;
  return (
    <ReadingPage
      locale={raw}
      crumbs={[...crumbs, { label: p.name_en }]}
      kicker={t.people.groups[p.group]}
      title={<Name en={p.name_en} ar={p.name_ar} locale={locale} />}
      lead={p.summary ? <span lang="en" dir="ltr">{p.summary}</span> : undefined}
    >
      <div className="zq-pagebody he-page">
        <section className="he-sec" aria-labelledby="pp-about-h" data-testid="person-about">
          <h2 id="pp-about-h">{s.about}</h2>
          <dl className="he-facts-grid">
            <dt>{s.kind}</dt>
            <dd data-testid="person-kind" data-group={p.group}>
              {t.people.groups[p.group]}
            </dd>
            {p.honorific ? (
              <>
                <dt>{s.honorific}</dt>
                <dd lang="ar" dir="rtl">
                  {p.honorific}
                </dd>
              </>
            ) : null}
          </dl>
          {p.journeyHref ? (
            <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href={p.journeyHref}>
              {t.people.read}
            </Link>
          ) : null}
        </section>

        <IdentificationBlock subject={p.subject} t={t} locale={locale} />
        <QuranSection evidence={p.evidence} subject={p.subject} t={t} lang={locale} />

        {p.aliases.length ? (
          <section className="he-sec" aria-labelledby="pp-alias-h" data-testid="aliases">
            <h2 id="pp-alias-h">{s.aliases}</h2>
            <p className="zq-meta">{s.aliasesNote}</p>
            <ul className="he-list">
              {p.aliases.map((a) => (
                <li key={`${a.alias}-${a.language}`}>
                  <span lang={a.language} dir={a.language === "ar" || a.language === "ur" ? "rtl" : "ltr"}>
                    {a.alias}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <FamilySection edges={p.family} t={t} locale={locale} />
        <EventsSection events={p.events} t={t} locale={locale} />
        <StoryLinks stories={p.hadithStories} locale={locale} t={hs} title={s.hadithStories} empty={s.noHadithStories} />
        <NotEstablished
          t={t}
          items={[
            { label: s.lineage, value: p.family.some((e) => e.kind === "parent_of" && e.direction === "in") ? p.family.filter((e) => e.kind === "parent_of" && e.direction === "in").map((e) => e.other.name_en).join(", ") : null },
            { label: s.age, value: p.lifespan?.known ? p.lifespan.value : null },
            { label: s.profession, value: null },
            { label: s.place, value: null },
          ]}
        />
        <AiDraftStory slug={slug} locale={raw} fallback={null} />
        <p>
          <Link className="zq-btn zq-btn-secondary zq-btn-link" href="/people">
            {s.back}
          </Link>
        </p>
      </div>
    </ReadingPage>
  );
}
