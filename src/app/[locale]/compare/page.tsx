import type { Metadata } from "next";
import Link from "next/link";
import { ayahArabic, quranSource } from "@/content/quran";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { getServerSupabase } from "@/lib/supabase/server";
import { parseAyahRange } from "@/lib/refs";
import { QuranAttribution } from "@/components/quran/QuranAttribution";
import { englishContent } from "@/lib/i18n/locales";
import { compareStrings } from "@/lib/i18n/modules/search";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = compareStrings((await params).locale);
  return { title: t.title, description: t.metaDescription };
}

interface Tr {
  translator: string;
  edition: string;
  language: string;
  text: string;
  sources: { work: string; license_text: string | null; attribution: string | null; updated_at: string } | null;
}

/** Flow F: compare licensed translations of one ayah, each with its translator, edition, licence and source date. */
export default async function ComparePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { locale } = await params;
  const { ref = "1:1" } = await searchParams;
  const s = compareStrings(locale);
  const en = englishContent(locale);
  const r = parseAyahRange(ref);
  const arabic = r ? ayahArabic(r.surah, r.from) : null;
  const src = quranSource();
  const sb = r ? await getServerSupabase() : null;
  const translations = sb && r
    ? ((await sb.from("quran_translations").select("translator, edition, language, text, sources(work, license_text, attribution, updated_at)").eq("surah_id", r.surah).eq("ayah_no", r.from)).data as Tr[] | null)
    : null;

  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: s.title }]}
      title={s.title}
      lead={s.lead}
    >
      <div className="zq-pagebody">
        <form method="get" className="zq-form" aria-label={s.choose}>
          <div className="zq-field">
            <label htmlFor="ref">{s.ref}</label>
            <input id="ref" name="ref" className="zq-input" dir="ltr" defaultValue={ref} pattern="\d{1,3}:\d{1,3}" placeholder="12:4" />
            <span className="zq-help">{s.refHelp}</span>
          </div>
          <div>
            <button type="submit" className="zq-btn zq-btn-secondary">
              {s.compare}
            </button>
          </div>
        </form>
        {!r ? (
          <EmptyState title={s.notRef}>
            <p>{s.notRefBody}</p>
          </EmptyState>
        ) : (
          <div className="zq-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
            <article className="zq-card" style={{ maxWidth: "none", background: "var(--surface-sunken)" }} aria-label={s.original}>
              <div className="zq-card-head">
                <p className="zq-eyebrow">{s.original}</p>
                <span style={{ display: "flex", gap: 6 }}>
                  <EvidenceLabel kind="quran" />
                  <CitationChip href={`/quran/${r.surah}#ayah-${r.from}`}>{`Q ${r.surah}:${r.from}`}</CitationChip>
                </span>
              </div>
              {arabic ? (
                <p className="zq-ar-quran" lang="ar" dir="rtl">
                  {arabic}
                </p>
              ) : (
                <p className="zq-licence zq-licence-pending">{s.arabicPending}</p>
              )}
              <QuranAttribution src={src} className="zq-licence" />
            </article>
            {translations?.length ? (
              translations.map((t) => (
                <article key={t.translator + t.edition} className="zq-card" style={{ maxWidth: "none" }}>
                  <div className="zq-card-head">
                    <p className="zq-eyebrow">{t.language.toUpperCase()}</p>
                    <span className="zq-meta" {...en}>
                      {t.translator}
                    </span>
                  </div>
                  <p className="zq-trans" lang={t.language} dir={t.language === "ar" || t.language === "ur" ? "rtl" : "ltr"}>
                    {t.text}
                  </p>
                  <dl className="zq-kv">
                    <dt>{s.edition}</dt>
                    <dd {...en}>{t.edition}</dd>
                    <dt>{s.licence}</dt>
                    <dd>{t.sources?.license_text ? <span {...en}>{t.sources.license_text}</span> : s.inRegister}</dd>
                    <dt>{s.recorded}</dt>
                    <dd>{t.sources?.updated_at ? new Date(t.sources.updated_at).toLocaleDateString(locale) : "—"}</dd>
                  </dl>
                </article>
              ))
            ) : (
              <EmptyState label={<span className="zq-licence zq-licence-pending">{s.licencePending}</span>} title={s.noTranslation}>
                <p>
                  {s.noTranslationBody} <Link href="/methodology#licences">{s.register}</Link>
                  {s.tafsirToo}
                </p>
              </EmptyState>
            )}
          </div>
        )}
      </div>
    </ReadingPage>
  );
}
