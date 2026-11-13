import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { KidsMode } from "@/components/creation/KidsMode";
import { CreationVisual } from "@/components/creation/CreationVisual";
import { ProfileView } from "@/components/creation/ProfileView";
import { CATEGORIES, getCreationProfile } from "@/lib/data/creation";
import { creationStrings } from "@/lib/i18n/modules/creation";
import { RelatedKnowledge } from "@/components/graph/RelatedKnowledge";
import { DraftFields } from "@/components/sourced/DraftFields";
import { creationDrafts } from "@/lib/sourced/data";
import { CREATION_FIELDS } from "@/lib/sourced/kinds";

export const revalidate = 300;

const SLUG = /^[a-z0-9-]{2,60}$/;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = creationStrings(locale);
  if (!SLUG.test(slug)) return { title: t.title };
  const r = await getCreationProfile(slug);
  const p = r.state === "ok" ? r.atlas?.profiles[0] : null;
  return { title: p ? `${locale === "ar" ? p.nameAr : p.nameEn} · ${t.title}` : t.title };
}

export default async function CreationProfilePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  // Content language for names (Arabic or English rows); interface strings follow the interface language (en, ar, ur).
  const locale = raw === "ar" ? "ar" : "en";
  const t = creationStrings(raw);
  if (!SLUG.test(slug)) notFound();
  const r = await getCreationProfile(slug);
  const draft = creationDrafts().get(slug);
  if (draft && !(r.state === "ok" && r.atlas?.profiles[0])) {
    const cat = CATEGORIES.find((c) => c.id === draft.category);
    return (
      <ReadingPage
        locale={raw}
        crumbs={[{ href: "/creation", label: t.title }, { label: locale === "ar" ? draft.name_ar : draft.name_en }]}
        kicker={<span className="pp-chap">{locale === "ar" ? cat?.nameAr : cat?.nameEn}</span>}
        title={
          <>
            {locale === "ar" ? draft.name_ar : draft.name_en}{" "}
            {locale === "en" ? (
              <small lang="ar" dir="rtl" className="cr-h1-ar">
                {draft.name_ar}
              </small>
            ) : null}
          </>
        }
      >
        <div className="zq-pagebody cr-body">
          <DraftFields fields={draft.fields} order={CREATION_FIELDS} labels={t.profile.fields} locale={raw} testId="creation-draft" />
          <RelatedKnowledge kind="creation" slug={draft.slug} locale={raw} />
        </div>
      </ReadingPage>
    );
  }
  if (r.state !== "ok")
    return (
      <ReadingPage locale={raw} crumbs={[{ href: "/creation", label: t.title }, { label: t.profile.crumb }]} title={t.title}>
        <div className="zq-pagebody">
          <EmptyState tone={r.state === "not_configured" ? "soon" : "unknown"} label={<span className="zq-soon">{t.evidence.not_established}</span>} title={r.state === "error" ? t.empty.error : t.empty.notConfigured}>
            <p>{t.empty.notConfiguredBody}</p>
          </EmptyState>
        </div>
      </ReadingPage>
    );
  const atlas = r.atlas;
  const profile = atlas?.profiles[0];
  if (!atlas || !profile) notFound();
  const cat = CATEGORIES.find((c) => c.id === profile.categoryId)!;
  const visuals = atlas.visuals.filter((v) => v.profileId === profile.id);
  return (
    <ReadingPage
      locale={raw}
      crumbs={[{ href: "/creation", label: t.title }, { label: locale === "ar" ? profile.nameAr : profile.nameEn }]}
      kicker={<span className="pp-chap">{locale === "ar" ? cat.nameAr : cat.nameEn}</span>}
      title={
        <>
          {locale === "ar" ? profile.nameAr : profile.nameEn}{" "}
          {locale === "en" ? (
            <small lang="ar" dir="rtl" className="cr-h1-ar">
              {profile.nameAr}
            </small>
          ) : null}
        </>
      }
    >
      <KidsMode label={t.kids.label} onText={t.kids.on}>
        <div className="zq-pagebody cr-body">
          {visuals.length ? (
            <div className="cr-visuals">
              {visuals.map((v) =>
                v.animationKey ? (
                  <CreationVisual key={v.id} animation={v.animationKey} alt={v.alt} caption={v.alt} strings={t.visual} />
                ) : v.imageUrl ? (
                  <figure key={v.id} className="qs-figure">
                    {/* eslint-disable-next-line @next/next/no-img-element -- reviewed asset from storage */}
                    <img src={v.imageUrl} alt={v.alt} loading="lazy" />
                    <figcaption className="zq-meta">{t.visual.note}</figcaption>
                  </figure>
                ) : null,
              )}
            </div>
          ) : null}
          <ProfileView atlas={atlas} profile={profile} t={t} locale={locale} />
        </div>
      </KidsMode>
    </ReadingPage>
  );
}
