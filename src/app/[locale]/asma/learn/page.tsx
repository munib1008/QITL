import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { AiDraftBanner } from "@/components/asma/Parts";
import { Learn } from "@/components/asma/Learn";
import { asmaNames } from "@/lib/data/asma";
import { getDict } from "@/lib/i18n";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import { pick } from "@/lib/asma/model";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = asmaStrings((await params).locale);
  return { title: s.learn.title, description: s.learn.lead };
}

export default async function LearnPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const s = asmaStrings(locale);
  const names = await asmaNames();
  return (
    <ReadingPage locale={raw} crumbs={[{ href: "/asma", label: s.nav }, { label: s.learn.title }]} kicker={s.kicker} title={s.learn.title} lead={s.learn.lead}>
      <div className="zq-pagebody as-page">
        {names === null ? (
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.notConnected.title}</EvidenceLabel>} title={s.notConnected.title}>
            <p>{s.notConnected.body}</p>
          </EmptyState>
        ) : (
          <>
            {names.some((n) => !n.published) ? <AiDraftBanner locale={locale} /> : null}
            <Learn locale={locale} names={names.map((n) => ({ slug: n.slug, ar: n.vowelled, transliteration: n.transliteration, meaning: pick(n.rendering, locale) ?? "" }))} />
          </>
        )}
      </div>
    </ReadingPage>
  );
}
