import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { AiDraftBanner } from "@/components/asma/Parts";
import { asmaTopics } from "@/lib/data/asma";
import { getDict } from "@/lib/i18n";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import { quranHref, titleOf } from "@/lib/asma/model";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = asmaStrings((await params).locale);
  return { title: s.pathways.title, description: s.pathways.lead };
}

export default async function Pathways({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const s = asmaStrings(locale);
  const p = s.pathways;
  const topics = await asmaTopics();
  return (
    <ReadingPage locale={raw} crumbs={[{ href: "/asma", label: s.nav }, { label: p.title }]} kicker={s.kicker} title={p.title} lead={p.lead}>
      <div className="zq-pagebody as-page">
        {topics === null ? (
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.notConnected.title}</EvidenceLabel>} title={s.notConnected.title}>
            <p>{s.notConnected.body}</p>
          </EmptyState>
        ) : topics.length === 0 ? (
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{p.emptyTitle}</EvidenceLabel>} title={p.emptyTitle}>
            <p>{p.emptyBody}</p>
          </EmptyState>
        ) : (
          <>
            <AiDraftBanner locale={locale} />
            <p className="as-note">{s.name.topicsNote}</p>
            <ul className="as-sections" style={{ listStyle: "none", padding: 0, margin: 0 }} data-testid="pathways">
              {topics.map((t) => (
                <li key={t.slug} className="as-section">
                  <h2>{titleOf(t, locale)}</h2>
                  <ul className="as-list">
                    {t.names.map((n) => (
                      <li key={n.slug}>
                        <Link href={`/asma/${n.slug}`}>
                          <span lang="ar" dir="rtl">
                            {n.ar}
                          </span>{" "}
                          <span dir="ltr">{n.transliteration}</span>
                        </Link>
                        {n.surah && n.ayah ? (
                          <span className="zq-meta">
                            {p.verse}: <Link href={quranHref(n.surah, n.ayah)} dir="ltr">{`Q ${n.surah}:${n.ayah}`}</Link>
                          </span>
                        ) : (
                          <span className="zq-meta">{p.needsSource}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </ReadingPage>
  );
}
