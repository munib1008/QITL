import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { getServerSupabase } from "@/lib/supabase/server";
import type { EvidenceKind } from "@/content/journey";
import { englishContent } from "@/lib/i18n/locales";
import { lastHourStrings } from "@/lib/i18n/modules/events";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = lastHourStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

interface Sign {
  id: string;
  slug: string;
  title: string;
  title_ar: string | null;
  summary: string | null;
  category: "last_hour_minor" | "last_hour_major";
  relative_order: number | null;
  evidence_claims: { statement: string; evidence: EvidenceKind; claim_references: Array<{ kind: string; quran_surah: number | null; quran_ayah_from: number | null; quran_ayah_to: number | null }> } | null;
}

export default async function LastHourPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = lastHourStrings(locale);
  const en = englishContent(locale);
  const sb = await getServerSupabase();
  const signs = sb
    ? ((
        await sb
          .from("historical_events")
          .select("id, slug, title, title_ar, summary, category, relative_order, evidence_claims(statement, evidence, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to))")
          .in("category", ["last_hour_minor", "last_hour_major"])
          .eq("status", "published")
          .order("relative_order", { ascending: true, nullsFirst: false })
      ).data as Sign[] | null)
    : null;
  const groups: Array<[string, Sign[]]> = [
    [t.major, (signs ?? []).filter((s) => s.category === "last_hour_major")],
    [t.minor, (signs ?? []).filter((s) => s.category === "last_hour_minor")],
  ];

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: t.title }]}
      title={t.title}
      lead={
        <>
          <span {...en}>{t.faith}</span> {t.lead}
        </>
      }
      meta={
        <>
          <EvidenceLabel kind="quran" />
          <CitationChip href="/quran/7#ayah-187">Q 7:187</CitationChip>
          <span className="zq-meta" {...en}>
            {t.knowledge}
          </span>
        </>
      }
    >
      <div className="zq-pagebody">
        <section className="pp-card" aria-label={t.how}>
          <h3>{t.how}</h3>
          <ul className="zq-prose" style={{ margin: 0, paddingInlineStart: 20, fontSize: 15, lineHeight: "24px" }}>
            {t.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
        {signs?.length ? (
          groups.map(([title, list]) =>
            list.length ? (
              <section key={title} aria-labelledby={`g-${title}`}>
                <h2 id={`g-${title}`} className="zq-eyebrow">
                  {title}
                </h2>
                <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
                  {list.map((s) => (
                    <li key={s.id} id={s.slug} className="pp-card">
                      <span className="zq-order">{s.relative_order != null ? t.order(s.relative_order) : t.orderNone}</span>
                      <h3 style={{ font: "600 20px/26px var(--font-display)", textTransform: "none", letterSpacing: 0, color: "var(--ink)" }}>
                        <span {...en}>{s.title}</span> {s.title_ar ? <span lang="ar" dir="rtl" className="zq-jc-sar">{s.title_ar}</span> : null}
                      </h3>
                      {s.summary ? (
                        <p className="zq-meta" style={{ margin: 0 }} {...en}>
                          {s.summary}
                        </p>
                      ) : null}
                      {s.evidence_claims ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          <EvidenceLabel kind={s.evidence_claims.evidence} />
                          {s.evidence_claims.claim_references.map((r, i) =>
                            r.kind === "quran" && r.quran_surah ? (
                              <CitationChip key={i} href={`/quran/${r.quran_surah}#ayah-${r.quran_ayah_from}`}>{`Q ${r.quran_surah}:${r.quran_ayah_from}`}</CitationChip>
                            ) : (
                              <CitationChip key={i}>{r.kind}</CitationChip>
                            ),
                          )}
                        </div>
                      ) : null}
                      <p className="zq-meta" style={{ margin: 0 }}>
                        {t.noDate}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null,
          )
        ) : (
          <EmptyState label={<EvidenceLabel kind="unknown">{t.notPublished}</EvidenceLabel>} title={t.emptyTitle}>
            <p>
              {t.emptyBody} <Link href="/methodology">{t.methodology}</Link>.
            </p>
          </EmptyState>
        )}
      </div>
    </ReadingPage>
  );
}
