import type { Metadata } from "next";
import { BASE, QiraatShell } from "@/components/qiraat/Shell";
import { LoadState } from "@/components/qiraat/LoadState";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import type { EvidenceKind } from "@/content/journey";
import { qiraatStrings } from "@/lib/i18n/modules/qiraat";
import { getApprovedVariants } from "@/lib/qiraat/data";
import { riwayahLabel } from "@/lib/qiraat/model";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Compare readings",
  description: "Side-by-side qira'at readings, shown only from licensed text editions with a reviewed explanation.",
  alternates: { canonical: `${BASE}/compare` },
};

export default async function QiraatCompare({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = qiraatStrings(locale);
  const lang = locale === "ar" ? "ar" : "en";
  const variants = await getApprovedVariants();
  const list = variants.state === "ok" ? variants.data : [];

  return (
    <QiraatShell locale={locale} section="compare" title={t.compare.title} lead={t.compare.lead}>
      {list.length ? (
        <ul className="qr-list" data-testid="variants">
          {list.map((v) => (
            <li key={v.id} className="qr-card" data-variant={v.id}>
              <div className="qr-row">
                <CitationChip href={`/quran/${v.surah}#ayah-${v.ayah}`}>{`Q ${v.surah}:${v.ayah} · ${t.compare.word} ${v.word_position}`}</CitationChip>
                <span className="zq-eyebrow">{t.compare.kind[v.kind]}</span>
              </div>
              <div className="qr-compare">
                {v.readings.map((r) => (
                  <section key={r.riwayah_id} className="qr-card" aria-label={riwayahLabel(r.riwayah_id)}>
                    <h3>{riwayahLabel(r.riwayah_id)}</h3>
                    <p className="qr-reading" lang="ar" dir="rtl">
                      {r.reading_text}
                    </p>
                    <p className="zq-licence">{[r.edition_title, r.attribution].filter(Boolean).join(" · ")}</p>
                  </section>
                ))}
              </div>
              <h3>{t.compare.explanation}</h3>
              {v.claims.map((c) => (
                <div key={c.id} className="qr-row">
                  <EvidenceLabel kind={c.evidence as EvidenceKind} lang={lang} />
                  <p style={{ margin: 0 }}>{c.statement}</p>
                </div>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <div data-testid="compare-empty">
          <LoadState state={variants.state} t={t.compare} />
        </div>
      )}
    </QiraatShell>
  );
}
