import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { AiDraftBanner, isAiDraft } from "@/components/asma/Parts";
import { Gallery } from "@/components/asma/Gallery";
import { asmaNames } from "@/lib/data/asma";
import { getDict } from "@/lib/i18n";
import { asmaStrings } from "@/lib/i18n/modules/asma";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = asmaStrings((await params).locale);
  return { title: s.title, description: s.lead };
}

export default async function AsmaHub({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const s = asmaStrings(locale);
  const names = await asmaNames();
  const drafts = names?.filter(isAiDraft).length ?? 0;
  const approved = names ? names.length - drafts : 0;
  const cards = [
    { href: "/asma/dua", ...s.dashboard.cards.dua },
    { href: "/asma/pathways", ...s.dashboard.cards.pathways },
    { href: "/asma/ism-al-azam", ...s.dashboard.cards.ism },
    { href: "/asma/learn", ...s.dashboard.cards.learn },
    { href: "/asma/response", ...s.dashboard.cards.response },
  ];
  return (
    <ReadingPage locale={raw} crumbs={[{ label: s.nav }]} kicker={s.kicker} title={s.title} lead={s.lead}>
      <div className="zq-pagebody as-page">
        {names === null ? (
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.notConnected.title}</EvidenceLabel>} title={s.notConnected.title}>
            <p>{s.notConnected.body}</p>
          </EmptyState>
        ) : (
          <>
            {drafts > 0 ? <AiDraftBanner locale={locale} /> : null}
            <ul className="as-stats" data-testid="asma-stats">
              <li>
                <b dir="ltr">{names.length}</b>
                <span>{s.stats.names}</span>
              </li>
              <li>
                <b dir="ltr">{drafts}</b>
                <span>{s.stats.draftOnly}</span>
              </li>
              <li>
                <b dir="ltr">{approved}</b>
                <span>{s.stats.approved}</span>
              </li>
            </ul>
          </>
        )}
        <p className="as-note" data-testid="recognition-note">
          {s.recognition.note}
        </p>
        <section aria-labelledby="as-explore-h">
          <h2 id="as-explore-h" className="zq-eyebrow">
            {s.dashboard.heading}
          </h2>
          <ul className="as-cards" data-testid="asma-cards">
            {cards.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="as-card">
                  <b>{c.title}</b>
                  <span>{c.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {names && names.length > 0 ? (
          <Gallery names={names} locale={locale} />
        ) : names ? (
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.emptyTitle}</EvidenceLabel>} title={s.emptyTitle}>
            <p>{s.emptyBody}</p>
          </EmptyState>
        ) : null}
      </div>
    </ReadingPage>
  );
}
