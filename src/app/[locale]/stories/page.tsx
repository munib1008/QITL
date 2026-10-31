import type { Metadata } from "next";
import Link from "next/link";
import { getJourney, journeyStops } from "@/content/journey";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { DraftBadge, EvidenceLabel } from "@/components/ui/evidence";
import { Rosette } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/misc";
import { getServerSupabase } from "@/lib/supabase/server";
import { englishContent } from "@/lib/i18n/locales";
import { storiesStrings } from "@/lib/i18n/modules/prophets";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = storiesStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

export default async function StoriesIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = storiesStrings(locale);
  const en = englishContent(locale);
  const sb = await getServerSupabase();
  const stories = sb ? (await sb.from("stories").select("slug, title, title_ar, summary, published_at").eq("status", "published").order("published_at", { ascending: false })).data : null;
  // Journey stops with a reviewed-for-draft outline are the first story pages.
  const outlines = journeyStops().filter((s) => s.story?.length);
  const j = getJourney();

  return (
    <ReadingPage locale={locale} crumbs={[{ label: t.title }]} title={t.title} lead={t.lead}>
      <div className="zq-pagebody">
        {stories?.length ? (
          <div className="zq-grid">
            {stories.map((s: { slug: string; title: string; title_ar: string | null; summary: string }) => (
              <Link key={s.slug} href={`/stories/${s.slug}`} className="zq-card" style={{ textDecoration: "none", color: "var(--ink)", maxWidth: "none" }}>
                <Rosette points={12} className="zq-prophet-mark" />
                <h2 className="zq-title" style={{ fontFamily: "var(--font-display)", fontSize: 22 }} {...en}>
                  {s.title}
                </h2>
                {s.title_ar ? (
                  <p lang="ar" dir="rtl" className="zq-prophet-ar" style={{ margin: 0 }}>
                    {s.title_ar}
                  </p>
                ) : null}
                <p className="zq-meta" {...en}>
                  {s.summary}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState label={<EvidenceLabel kind="unknown">{t.nonePublished}</EvidenceLabel>} title={t.emptyTitle}>
            <p>{t.emptyBody}</p>
          </EmptyState>
        )}
        {outlines.length ? (
          <section aria-labelledby="outlines-h">
            <h2 id="outlines-h" className="zq-eyebrow">
              {t.outlines}
            </h2>
            <div style={{ marginBlock: 8 }}>
              <DraftBadge status={j.status} />
            </div>
            <div className="zq-grid">
              {outlines.map((s) => (
                <Link key={s.id} href={`/prophets/${s.id}#story`} className="zq-card" style={{ textDecoration: "none", color: "var(--ink)", maxWidth: "none" }}>
                  <p className="zq-eyebrow">{t.movements(s.story!.length)}</p>
                  <h3 className="zq-title" style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
                    <span {...en}>{s.name}</span> <span lang="ar">{s.honorific}</span>
                  </h3>
                  <p className="zq-meta" {...en}>
                    {s.subtitle}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </ReadingPage>
  );
}
