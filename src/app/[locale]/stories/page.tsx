import type { Metadata } from "next";
import Link from "next/link";
import { getJourney, journeyStops } from "@/content/journey";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { DraftBadge, EvidenceLabel } from "@/components/ui/evidence";
import { Rosette } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/misc";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Stories", description: "Long-form, cited narratives of the prophets, chapter by chapter." };

export default async function StoriesIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const sb = await getServerSupabase();
  const stories = sb ? (await sb.from("stories").select("slug, title, title_ar, summary, published_at").eq("status", "published").order("published_at", { ascending: false })).data : null;
  // Journey stops with a reviewed-for-draft outline are the first story pages.
  const outlines = journeyStops().filter((s) => s.story?.length);
  const j = getJourney();

  return (
    <ReadingPage locale={locale} crumbs={[{ label: "Stories" }]} title="Stories" lead="Long-form narratives, chapter by chapter, with every claim cited to the Quran or an authenticated narration.">
      <div className="zq-pagebody">
        {stories?.length ? (
          <div className="zq-grid">
            {stories.map((s: { slug: string; title: string; title_ar: string | null; summary: string }) => (
              <Link key={s.slug} href={`/stories/${s.slug}`} className="zq-card" style={{ textDecoration: "none", color: "var(--ink)", maxWidth: "none" }}>
                <Rosette points={12} className="zq-prophet-mark" />
                <h2 className="zq-title" style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>
                  {s.title}
                </h2>
                {s.title_ar ? (
                  <p lang="ar" dir="rtl" className="zq-prophet-ar" style={{ margin: 0 }}>
                    {s.title_ar}
                  </p>
                ) : null}
                <p className="zq-meta">{s.summary}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState label={<EvidenceLabel kind="unknown">None published yet</EvidenceLabel>} title="No full stories are published yet.">
            <p>A story is published only when every chapter&apos;s claims are cited and approved by the scholarly reviewers.</p>
          </EmptyState>
        )}
        {outlines.length ? (
          <section aria-labelledby="outlines-h">
            <h2 id="outlines-h" className="zq-eyebrow">
              Story outlines on the journey
            </h2>
            <div style={{ marginBlock: 8 }}>
              <DraftBadge status={j.status} />
            </div>
            <div className="zq-grid">
              {outlines.map((s) => (
                <Link key={s.id} href={`/prophets/${s.id}#story`} className="zq-card" style={{ textDecoration: "none", color: "var(--ink)", maxWidth: "none" }}>
                  <p className="zq-eyebrow">{s.story!.length} movements</p>
                  <h3 className="zq-title" style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
                    {s.name} <span lang="ar">{s.honorific}</span>
                  </h3>
                  <p className="zq-meta">{s.subtitle}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </ReadingPage>
  );
}
