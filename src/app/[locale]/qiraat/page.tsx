import type { Metadata } from "next";
import Link from "next/link";
import { BASE, QiraatShell } from "@/components/qiraat/Shell";
import { LoadState } from "@/components/qiraat/LoadState";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import type { EvidenceKind } from "@/content/journey";
import { qiraat, qiraatStrings } from "@/lib/i18n/modules/qiraat";
import { englishContent } from "@/lib/i18n/locales";
import { getMisconceptions, getReaders, refLabel } from "@/lib/qiraat/data";
import { AHRUF_HADITH_REFS } from "@/lib/qiraat/model";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const l = (await params).locale;
  const t = qiraatStrings(l);
  return {
  title: t.title,
  description: t.lead,
  alternates: { canonical: BASE },
};
}

export default async function QiraatHub({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = qiraatStrings(locale);
  const [readers, misconceptions] = await Promise.all([getReaders(), getMisconceptions()]);

  return (
    <QiraatShell locale={locale} section="hub" title={t.title} lead={t.lead}>
      <section className="qr-section" aria-labelledby="qr-hadith-h">
        <h2 id="qr-hadith-h">{t.hadith.title}</h2>
        <p className="zq-meta">{t.hadith.lead}</p>
        <ul className="qr-list qr-list-3" data-testid="ahruf-refs">
          {AHRUF_HADITH_REFS.map((h) => (
            <li key={h.href} className="qr-card">
              <div className="qr-row">
                <EvidenceLabel kind="hadith" lang={locale} />
                <CitationChip href={h.href}>{`${h.collectionName} ${h.number}`}</CitationChip>
              </div>
              <p className="zq-licence zq-licence-pending">{t.hadith.licencePending}</p>
              <p className="zq-meta">{t.hadith.numbering}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="qr-section" aria-labelledby="qr-dist-h">
        <h2 id="qr-dist-h">{t.distinction.title}</h2>
        <div className="qr-draft" data-testid="distinction-panel">
          <p style={{ margin: 0 }}>
            <EvidenceLabel kind="disputed" lang={locale}>
              {t.draft}
            </EvidenceLabel>
          </p>
          {/* Scholarly statements are not translated in every language; untranslated ones stay marked as English. */}
          <ul {...(locale !== "en" && t.distinction.points === qiraat.en.distinction.points ? englishContent(locale) : {})}>
            {t.distinction.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="zq-meta" style={{ margin: 0 }}>
            {t.distinction.note}
          </p>
        </div>
      </section>

      <section className="qr-section" aria-labelledby="qr-readers-h">
        <h2 id="qr-readers-h">{t.readers.title}</h2>
        <p className="zq-meta">{t.readers.lead}</p>
        {readers.state === "ok" && readers.data.length ? (
          <div className="qr-table-wrap" data-testid="readers-table">
            <table className="qr-table">
              <thead>
                <tr>
                  <th scope="col">{t.readers.reader}</th>
                  <th scope="col">{t.readers.transmitters}</th>
                </tr>
              </thead>
              <tbody>
                {readers.data.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">
                      {r.name_translit}{" "}
                      <span lang="ar" dir="rtl">
                        {r.name_ar}
                      </span>
                    </th>
                    <td>
                      {r.riwayat.map((w, i) => (
                        <span key={w.id}>
                          {i ? " · " : ""}
                          {w.name_translit}{" "}
                          <span lang="ar" dir="rtl">
                            {w.name_ar}
                          </span>
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div data-testid="readers-empty">
            <LoadState state={readers.state} t={t.readers} />
          </div>
        )}
      </section>

      <section className="qr-section" aria-labelledby="qr-avail-h">
        <h2 id="qr-avail-h">{t.available.title}</h2>
        <div className="qr-avail">
          <div className="qr-card" data-testid="available-now">
            <h3>{t.available.now}</h3>
            <p style={{ margin: 0 }}>{t.available.nowItem}</p>
            <Link href="/quran/1">{t.available.openReader}</Link>
          </div>
          <div className="qr-card" data-testid="not-licensed">
            <h3>{t.available.notYet}</h3>
            <p style={{ margin: 0 }}>{t.available.notYetBody}</p>
            <p className="zq-licence zq-licence-pending" style={{ margin: 0 }}>
              {t.available.audio}
            </p>
          </div>
        </div>
      </section>

      <section className="qr-section" aria-labelledby="qr-mis-h">
        <h2 id="qr-mis-h">{t.misconceptions.title}</h2>
        <p className="zq-meta">{t.misconceptions.lead}</p>
        {misconceptions.state === "ok" && misconceptions.data.length ? (
          <ul className="qr-list" data-testid="misconceptions">
            {misconceptions.data.map((m) => (
              <li key={m.id} className="qr-card">
                <h3>{m.question}</h3>
                <p style={{ margin: 0 }}>{m.claim.statement}</p>
                <div className="qr-row">
                  <EvidenceLabel kind={m.claim.evidence as EvidenceKind} lang={locale} />
                  {m.claim.refs.map((r) => (
                    <CitationChip key={refLabel(r)} href={r.kind === "quran" && r.quran_surah ? `/quran/${r.quran_surah}#ayah-${r.quran_ayah_from ?? 1}` : undefined}>
                      {refLabel(r)}
                    </CitationChip>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div data-testid="misconceptions-empty">
            <EmptyState title={t.misconceptions.empty} />
          </div>
        )}
      </section>
    </QiraatShell>
  );
}
