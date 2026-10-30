import type { Metadata } from "next";
import { INFO_PAGES } from "@/content/pages";
import { ReadingPage } from "./ReadingPage";

export function infoMetadata(slug: keyof typeof INFO_PAGES): Metadata {
  const p = INFO_PAGES[slug]!;
  return { title: p.title, description: p.lead };
}

/** Renders one editorial page from src/content/pages.tsx. */
export async function InfoPageView({ params, slug, crumbs }: { params: Promise<{ locale: string }>; slug: string; crumbs?: Array<{ href?: string; label: string }> }) {
  const { locale } = await params;
  const p = INFO_PAGES[slug]!;
  return (
    <ReadingPage locale={locale} crumbs={crumbs ?? [{ label: p.title }]} title={p.title} lead={p.lead}>
      <div className="zq-pagebody">
        {p.draftNotice ? (
          <p className="zq-banner" role="note">
            {p.draftNotice}
          </p>
        ) : null}
        <div className="zq-prose">{p.body}</div>
      </div>
    </ReadingPage>
  );
}
