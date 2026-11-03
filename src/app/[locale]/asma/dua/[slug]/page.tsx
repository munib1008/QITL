import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { quranSource, surahArabic } from "@/content/quran";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { AiDraftBadge, AiDraftBanner, Section, Unavailable } from "@/components/asma/Parts";
import { asmaDua } from "@/lib/data/asma";
import { getDict } from "@/lib/i18n";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import { quranHref, titleOf } from "@/lib/asma/model";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const dua = await asmaDua(slug);
  return { title: dua ? `${titleOf(dua, locale) || slug} · ${asmaStrings(locale).dua.title}` : asmaStrings(locale).dua.title, robots: dua ? undefined : { index: false } };
}

export default async function DuaPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const { locale } = getDict(raw);
  const s = asmaStrings(locale);
  const d = s.dua;
  const dua = await asmaDua(slug);
  if (dua === undefined) notFound();
  const crumbs = [{ href: "/asma", label: s.nav }, { href: "/asma/dua", label: d.title }, { label: dua ? titleOf(dua, locale) || slug : slug }];
  if (dua === null)
    return (
      <ReadingPage locale={raw} crumbs={crumbs} kicker={s.kicker} title={d.title} lead={d.lead}>
        <div className="zq-pagebody as-page">
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.notConnected.title}</EvidenceLabel>} title={s.notConnected.title}>
            <p>{s.notConnected.body}</p>
          </EmptyState>
        </div>
      </ReadingPage>
    );
  const src = dua.source;
  const verses = src.kind === "quran" ? (surahArabic(src.surah) ?? []).filter((v) => v.ayah >= src.from && v.ayah <= src.to) : [];
  return (
    <ReadingPage locale={raw} crumbs={crumbs} kicker={s.kicker} title={titleOf(dua, locale) || slug} lead={dua.category === "A" ? d.categoryA : d.categoryB} meta={<AiDraftBadge locale={locale} reviewed={dua.published && dua.scholarly_status === "approved"} />}>
      <div className="zq-pagebody as-page">
        {dua.published && dua.scholarly_status === "approved" ? null : <AiDraftBanner locale={locale} status={dua.scholarly_status} />}
        {dua.category === "A" ? (
          <Section id="as-ds" title={d.categoryA}>
            {src.kind === "quran" ? (
              <>
                <EvidenceLabel kind="quran" lang={locale} />
                {verses.length ? (
                  <div data-testid="dua-quran-text">
                    {verses.map((v) => (
                      <p key={v.ayah} className="as-verse" lang="ar" dir="rtl">
                        {v.text}
                      </p>
                    ))}
                    <QuranAttribution src={quranSource()} />
                  </div>
                ) : null}
                <Link href={quranHref(src.surah, src.from)} dir="ltr">{`Q ${src.surah}:${src.from}${src.to !== src.from ? `–${src.to}` : ""}`}</Link>
              </>
            ) : src.kind === "hadith" ? (
              <>
                <EvidenceLabel kind="hadith" lang={locale} />
                <p>
                  {s.name.hadith.collection}: <span dir="ltr">{src.collection}</span> · {s.name.hadith.number}: <span dir="ltr">{src.number}</span>
                  {src.grading ? ` · ${s.name.hadith.grading}: ${src.grading.grade} (${src.grading.grader})` : null}
                </p>
                <p className="as-note">{s.name.hadith.note}</p>
              </>
            ) : (
              <Unavailable locale={locale}>{src.reference_label ?? d.needsSource}</Unavailable>
            )}
          </Section>
        ) : (
          <Section id="as-dp" title={d.categoryB}>
            <p className="as-stamp" data-testid="personal-label">
              {dua.wording_label ?? d.personalLabel}
            </p>
            <blockquote className="as-quote" data-testid="personal-wording">
              {dua.personal_wording}
            </blockquote>
          </Section>
        )}
        <Section id="as-dn" title={d.linkedNames}>
          {dua.names.length ? (
            <ul className="as-list">
              {dua.names.map((n) => (
                <li key={n.slug}>
                  <Link href={`/asma/${n.slug}`}>
                    <span lang="ar" dir="rtl">
                      {n.ar}
                    </span>{" "}
                    <span dir="ltr">{n.transliteration}</span>
                  </Link>
                  {n.note ? <span className="zq-meta">{n.note}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <Unavailable locale={locale}>{s.name.noDuas}</Unavailable>
          )}
        </Section>
        <Link className="zq-btn zq-btn-quiet zq-btn-link" href="/asma/dua">
          {d.backToDuas}
        </Link>
      </div>
    </ReadingPage>
  );
}
