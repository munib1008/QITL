import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import "@/styles/qa.css";
import { dreamsT } from "@/lib/i18n/modules/dreams";
import { HADITH_DREAM_REFERENCES, QURAN_DREAM_REFERENCES, SURAH_NAMES, quranRefHref, quranRefLabel } from "@/lib/dreams";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const l = (await params).locale;
  const t = dreamsT(l).guide;
  return { title: t.title, description: t.lead };
}

/**
 * "Understand Dreams in Islam". Static: references only, never Quran or hadith text typed into the page. Hadith
 * references show the licence-pending state. No interpretation, prediction, classification or symbol dictionary,
 * and no imagery.
 */
export default async function DreamsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = dreamsT(locale);
  const g = t.guide;
  const lang = locale === "ar" ? "ar" : "en";
  return (
    <ReadingPage
      locale={locale}
      crumbs={[{ label: t.crumbs.dreams }]}
      kicker={
        <span lang="ar" dir="rtl">
          {g.arabicTitle}
        </span>
      }
      title={g.title}
      lead={g.lead}
    >
      <div className="zq-pagebody qa">
        <section className="qa-sec" aria-labelledby="dq-quran-h">
          <h2 id="dq-quran-h">{g.quranTitle}</h2>
          <p>{g.quranLead}</p>
          <ul className="qa-refs" data-testid="quran-dream-refs">
            {QURAN_DREAM_REFERENCES.map((r) => (
              <li key={`${r.surah}:${r.from}`}>
                <Link href={quranRefHref(r)} data-citation="">
                  <b dir="ltr">{quranRefLabel(r)}</b>
                  <small>{g.surah(r.surah, SURAH_NAMES[r.surah]?.[lang] ?? String(r.surah))}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="qa-sec" aria-labelledby="dq-sunnah-h">
          <h2 id="dq-sunnah-h">{g.sunnahTitle}</h2>
          <p>{g.sunnahLead}</p>
          <ul className="qa-list" data-testid="hadith-dream-refs">
            {HADITH_DREAM_REFERENCES.map((h) => (
              <li key={h.key} className="qa-card">
                <h3>{h.key === "kinds" ? g.kinds : g.goodBad}</h3>
                <div className="qa-actions">
                  <EvidenceLabel kind="hadith" lang={locale} />
                  <Link className="zq-chip" href={h.href} data-citation="">
                    <span dir="ltr">
                      {h.collectionName}
                      {h.number ? ` ${h.number}` : ""}
                    </span>
                  </Link>
                </div>
                {"book" in h && h.book ? (
                  <p className="zq-meta" dir="ltr">
                    {h.book}
                  </p>
                ) : null}
                <p className="zq-licence zq-licence-pending">{g.licencePending}</p>
                <p className="zq-meta">{g.numbering}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="qa-sec" aria-labelledby="dq-distress-h">
          <h2 id="dq-distress-h">{g.distressTitle}</h2>
          <p>{g.distressBody}</p>
          <div className="qa-support" role="note" data-testid="wellbeing">
            <b>{g.supportTitle}</b>
            <p>{g.supportBody}</p>
            <p>{g.emergency}</p>
          </div>
        </section>

        <section className="qa-sec" aria-labelledby="dq-limits-h">
          <h2 id="dq-limits-h">{g.limitsTitle}</h2>
          <ul className="qa-limits">
            {g.limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>

        <section className="qa-card qa-sec" aria-labelledby="dq-req-h">
          <h2 id="dq-req-h">{g.requestTitle}</h2>
          <p>{g.requestBody}</p>
          <p className="qa-notice">{t.fallibility}</p>
          <div className="qa-actions">
            <Link className="zq-btn zq-btn-primary" href="/dreams/request">
              {g.requestCta}
            </Link>
            <Link className="zq-btn zq-btn-secondary" href="/dreams/my">
              {g.mineCta}
            </Link>
          </div>
        </section>

        <section className="qa-sec qa-faq" aria-labelledby="dq-faq-h">
          <h2 id="dq-faq-h">{g.faqTitle}</h2>
          <div>
            {g.faq.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </ReadingPage>
  );
}
