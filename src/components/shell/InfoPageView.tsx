import type { Metadata } from "next";
import { INFO_PAGES } from "@/content/pages";
import { englishContent } from "@/lib/i18n/locales";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { ReadingPage } from "./ReadingPage";

/** Title and lead in the interface language (interface text); the page body is English editorial content. */
function heading(slug: string, locale: string) {
  const p = INFO_PAGES[slug]!;
  const t = (uiStrings(locale).info as unknown as Record<string, { title: string; lead: string } | undefined>)[slug];
  return { title: t?.title ?? p.title, lead: t?.lead ?? p.lead };
}

export function infoMetadata(slug: keyof typeof INFO_PAGES) {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params;
    const h = heading(slug, locale);
    return { title: h.title, description: h.lead };
  };
}

/** Renders one editorial page from src/content/pages.tsx. */
export async function InfoPageView({ params, slug, crumbs }: { params: Promise<{ locale: string }>; slug: string; crumbs?: Array<{ href?: string; label: string }> }) {
  const { locale } = await params;
  const p = INFO_PAGES[slug]!;
  const h = heading(slug, locale);
  const u = uiStrings(locale);
  const en = englishContent(locale);
  return (
    <ReadingPage locale={locale} crumbs={crumbs ?? [{ label: h.title }]} title={h.title} lead={h.lead}>
      <div className="zq-pagebody">
        {p.draftNotice ? (
          <p className="zq-banner" role="note">
            {u.info.legalDraft}
          </p>
        ) : null}
        {locale !== "en" ? (
          <p className="zq-meta" role="note" data-testid="english-content-note">
            {u.shell.englishContent}
          </p>
        ) : null}
        <div className="zq-prose" {...en}>
          {p.body}
        </div>
      </div>
    </ReadingPage>
  );
}
