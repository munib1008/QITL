import type { Metadata } from "next";
import Link from "next/link";
import { ayahArabic, quranSource } from "@/content/quran";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { getServerSupabase } from "@/lib/supabase/server";
import { parseAyahRange } from "@/lib/refs";
import { QuranAttribution } from "@/components/quran/QuranAttribution";

export const metadata: Metadata = { title: "Compare sources", description: "Translations and scholarly readings side by side, with licence and source dates shown." };

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
      crumbs={[{ label: "Compare sources" }]}
      title="Compare sources"
      lead="One ayah, every licensed translation beside the Arabic, each with its translator, edition, licence and the date the source was recorded."
    >
      <div className="zq-pagebody">
        <form method="get" className="zq-form" aria-label="Choose an ayah">
          <div className="zq-field">
            <label htmlFor="ref">Ayah reference</label>
            <input id="ref" name="ref" className="zq-input" dir="ltr" defaultValue={ref} pattern="\d{1,3}:\d{1,3}" placeholder="12:4" />
            <span className="zq-help">Surah and ayah, for example 12:4.</span>
          </div>
          <div>
            <button type="submit" className="zq-btn zq-btn-secondary">
              Compare
            </button>
          </div>
        </form>
        {!r ? (
          <EmptyState title="That is not an ayah reference.">
            <p>Write it as surah:ayah, for example 12:4.</p>
          </EmptyState>
        ) : (
          <div className="zq-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
            <article className="zq-card" style={{ maxWidth: "none", background: "var(--surface-sunken)" }} aria-label="Arabic original">
              <div className="zq-card-head">
                <p className="zq-eyebrow">Arabic original</p>
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
                <p className="zq-licence zq-licence-pending">Arabic not loaded — the verified source has not been imported yet.</p>
              )}
              <QuranAttribution src={src} className="zq-licence" />
            </article>
            {translations?.length ? (
              translations.map((t) => (
                <article key={t.translator + t.edition} className="zq-card" style={{ maxWidth: "none" }}>
                  <div className="zq-card-head">
                    <p className="zq-eyebrow">{t.language.toUpperCase()}</p>
                    <span className="zq-meta">{t.translator}</span>
                  </div>
                  <p className="zq-trans">{t.text}</p>
                  <dl className="zq-kv">
                    <dt>Edition</dt>
                    <dd>{t.edition}</dd>
                    <dt>Licence</dt>
                    <dd>{t.sources?.license_text ?? "Recorded in the source register"}</dd>
                    <dt>Source recorded</dt>
                    <dd>{t.sources?.updated_at ? new Date(t.sources.updated_at).toLocaleDateString() : "—"}</dd>
                  </dl>
                </article>
              ))
            ) : (
              <EmptyState label={<span className="zq-licence zq-licence-pending">Licence pending</span>} title="No translation is licensed for display yet.">
                <p>
                  Translations appear here only after their rights are cleared in the <Link href="/methodology#licences">licence register</Link>. Comparing scholarly readings
                  (tafsir) works the same way.
                </p>
              </EmptyState>
            )}
          </div>
        )}
      </div>
    </ReadingPage>
  );
}
